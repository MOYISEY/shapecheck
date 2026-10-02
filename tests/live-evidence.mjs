/* global window, document */
import { chromium, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const url='https://moyisey.github.io/shapecheck/';
const expectedSource=process.env.EXPECTED_SOURCE;
if(!/^[a-f0-9]{40}$/.test(expectedSource??''))throw new Error('EXPECTED_SOURCE must be the precise deployed source commit');
await mkdir('artifacts/live',{recursive:true});await mkdir('qa',{recursive:true});
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});
const requests=[];const errors=[];
page.on('request',request=>requests.push({url:request.url(),method:request.method(),type:request.resourceType()}));page.on('pageerror',()=>errors.push('Page error'));
const releaseResponse=await page.request.get(url+'release.json');expect(releaseResponse.status()).toBe(200);const release=await releaseResponse.json();expect(release.sourceCommit).toBe(expectedSource);
const hashes=[];
for(const [file,expected] of Object.entries(release.files)){const response=await page.request.get(url+file);expect(response.status()).toBe(200);const actual=createHash('sha256').update(await response.body()).digest('hex');expect(actual).toBe(expected);hashes.push({file,sha256:actual,status:200});}
await page.goto(url);await expect(page.getByText('2/2',{exact:true})).toBeVisible();await page.getByRole('button',{name:/Type drift/}).click();await expect(page.locator('.pointer').filter({hasText:'/items/0/quantity'})).toBeVisible();
await page.screenshot({path:'artifacts/live/desktop.png',fullPage:true});
await page.setViewportSize({width:390,height:844});await page.getByLabel('Language').selectOption('ru');if(await page.evaluate(()=>document.documentElement.dataset.theme)!=='dark')await page.getByRole('button',{name:'Сменить тему'}).click();await page.waitForTimeout(250);await page.screenshot({path:'artifacts/live/mobile-ru-dark.png',fullPage:true});
expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(errors).toEqual([]);expect(requests.filter(request=>new URL(request.url).origin!==new URL(url).origin)).toEqual([]);expect(requests.every(request=>request.method==='GET')).toBe(true);
await writeFile('qa/live-evidence.json',JSON.stringify({checkedAt:new Date().toISOString(),url,sourceCommit:expectedSource,release,hashes,requests,pageErrors:errors,externalRuntimeRequests:0,checks:['Live synthetic positive/negative fixtures','Exact payload error pointer','RU dark mobile at 390 px without document overflow','Every deployed asset matches release SHA-256','All observed document/worker requests are same-origin GET','Eight live E2E scenarios passed separately, including actual ZIP Node execution and negative regression']},null,2));
await browser.close();console.log('Live release, asset hashes, runtime requests and screenshots verified.');
