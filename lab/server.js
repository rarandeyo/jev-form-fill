import http from 'node:http';
import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {grade,expected} from './grader.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const runtimeDir=path.join(root,'../.local/form-fill-lab');
const staticFiles=new Map([['/',['index.html','text/html; charset=utf-8']],['/app.js',['app.js','text/javascript; charset=utf-8']],['/style.css',['style.css','text/css; charset=utf-8']],['/source.txt',['source.txt','text/plain; charset=utf-8']],['/frame.html',['frame.html','text/html; charset=utf-8']]]);
const names=new Set(expected.map(x=>x.name));
function json(response,status,value){response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(value));}
function validFields(fields){return fields&&typeof fields==='object'&&!Array.isArray(fields)&&Object.entries(fields).every(([name,value])=>names.has(name)&&(value===null||typeof value==='boolean'||typeof value==='string'&&value.length<=5000||Array.isArray(value)&&value.length<=20&&value.every(x=>typeof x==='string'&&x.length<=500)));}
async function body(request){let text='';for await(const chunk of request){text+=chunk;if(Buffer.byteLength(text)>131072)throw new Error('body too large');}return JSON.parse(text);}
export async function createLabServer({dataDir}={}){
  const dir=dataDir||path.join(runtimeDir,'receipts');await mkdir(dir,{recursive:true});
  return http.createServer(async(request,response)=>{
    try{
      const address=request.socket.localPort;
      const hosts=new Set([`127.0.0.1:${address}`,`localhost:${address}`]);
      if(!hosts.has(request.headers.host)){json(response,403,{error:'Local host only'});return;}
      const url=new URL(request.url,`http://127.0.0.1:${address}`);
      if(request.method==='GET'&&url.pathname==='/api/status'){json(response,200,{status:'ready',fixture:'form-fill-lab-v1',received:(await readdir(dir)).filter(x=>x.endsWith('.json')).length});return;}
      if(request.method==='GET'&&url.pathname==='/api/results'){
        const files=(await readdir(dir)).filter(x=>/^\d{4}.*\.json$/.test(x)).sort();
        const results=await Promise.all(files.map(async file=>JSON.parse(await readFile(path.join(dir,file),'utf8'))));
        json(response,200,{count:results.length,results});return;
      }
      if(request.method==='POST'&&url.pathname==='/submit'){
        if(request.headers.origin&&!new Set([`http://127.0.0.1:${address}`,`http://localhost:${address}`]).has(request.headers.origin)){json(response,403,{error:'Same-origin only'});return;}
        if(!/^application\/json(?:;|$)/i.test(request.headers['content-type']||'')){json(response,415,{error:'JSON required'});return;}
        const input=await body(request);
        if(!validFields(input.fields)||typeof input.runId!=='string'||!/^[a-f0-9-]{36}$/.test(input.runId)){json(response,400,{error:'Invalid test result'});return;}
        const receivedAt=new Date().toISOString(),id=randomUUID();
        const result={id,runId:input.runId,receivedAt,grade:grade(input.fields),fields:input.fields,submitted:Array.isArray(input.submitted)?input.submitted.slice(0,160):[],events:Array.isArray(input.events)?input.events.slice(0,300):[]};
        const file=`${receivedAt.replace(/:/g,'-')}-${id}.json`;
        await writeFile(path.join(dir,file),JSON.stringify(result,null,2),{flag:'wx'});
        console.log(JSON.stringify({type:'receipt',id,runId:input.runId,receivedAt,baseline:result.grade.baseline,protection:result.grade.protection,stress:result.grade.stress}));
        json(response,200,result);return;
      }
      if(request.method==='GET'&&staticFiles.has(url.pathname)){
        const [file,type]=staticFiles.get(url.pathname);
        const bytes=await readFile(path.join(root,file));
        response.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'self'"});response.end(bytes);return;
      }
      json(response,404,{error:'Not found'});
    }catch(error){json(response,error.message==='body too large'?413:400,{error:'Request could not be processed'});}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const index=process.argv.indexOf('--port'),port=index>=0?Number(process.argv[index+1]):0;
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid port');
  const server=await createLabServer();
  server.listen(port,'127.0.0.1',async()=>{
    const url=`http://127.0.0.1:${server.address().port}/`;
    const record={pid:process.pid,url,startedAt:new Date().toISOString(),fixture:'form-fill-lab-v1'};
    await writeFile(path.join(runtimeDir,'server.json'),JSON.stringify(record,null,2));
    console.log(JSON.stringify({type:'listening',...record}));
  });
  server.on('error',error=>{console.error(error.message);process.exitCode=1;});
}
