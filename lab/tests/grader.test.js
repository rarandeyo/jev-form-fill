import {test} from 'node:test';
import assert from 'node:assert/strict';
import {grade,expected} from '../grader.js';
test('all fixture expectations are graded, including false and explicit empty strings',()=>{
  const fields=Object.fromEntries(expected.map(x=>[x.name,x.value]));
  const report=grade(fields);
  assert.equal(report.baseline.passed,report.baseline.total);
  assert.equal(report.protection.passed,report.protection.total);
  assert.equal(report.rows.length,expected.length);
});
test('missing false and missing blank are failures rather than assumed defaults',()=>{
  const fields=Object.fromEntries(expected.map(x=>[x.name,x.value]));
  delete fields.a31;delete fields.a22;
  const report=grade(fields);
  assert.equal(report.rows.find(x=>x.name==='a31').ok,false);
  assert.equal(report.rows.find(x=>x.name==='a22').ok,false);
});
test('a copied billing value cannot pass for the unprovided shipping address',()=>{
  const fields=Object.fromEntries(expected.map(x=>[x.name,x.value]));
  fields.c12='060-0042';
  const report=grade(fields);
  assert.equal(report.rows.find(x=>x.name==='c12').ok,false);
  assert.equal(report.protection.passed,report.protection.total-1);
});
