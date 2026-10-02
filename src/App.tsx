import { useCallback, useEffect, useRef, useState } from 'react';
import { Braces, Check, ChevronRight, CircleHelp, Copy, Download, FileJson, Github, LoaderCircle, Moon, Play, Plus, ShieldCheck, Sun, Trash2, Upload, X, AlertTriangle, AlignLeft } from 'lucide-react';
import { bytes, importProject, parseJson, validateProject } from './core/safety';
import { sampleProject } from './core/sample';
import { LIMITS, type Batch, type Issue, type Language, type Project, type Result } from './core/types';
import { startValidation } from './core/worker-client';
import { download, exportSuite } from './core/export';
import { locatePointer } from './core/locate';
import { issueText, texts, type TextKey } from './i18n';

const STORAGE = 'shapecheck.workspace.v1';
function initial() {
  try { const saved = localStorage.getItem(STORAGE); if (saved) return { project: importProject(saved), remember: true }; } catch { /* Invalid stored data never replaces the safe demo. */ }
  return { project: sampleProject(), remember: false };
}
function emptyProject(): Project { return { version: 1, name: 'Untitled', schema: '{\n  "type": "object"\n}', fixtures: [{ id: crypto.randomUUID(), name: 'Fixture 1', expected: 'valid', payload: '{}' }] }; }
type Confirmation = { message: TextKey; apply: () => void };
function App() {
  const [loaded] = useState(initial);
  const [project,setProject] = useState(loaded.project);
  const [remember,setRemember] = useState(loaded.remember);
  const [lang,setLang] = useState<Language>('en');
  const [dark,setDark] = useState(() => !window.matchMedia('(prefers-color-scheme: light)').matches);
  const [selected,setSelected] = useState(project.fixtures[0].id);
  const [batch,setBatch] = useState<Batch>({ results: [] });
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState<TextKey | null>(null);
  const [help,setHelp] = useState(false);
  const [confirmation,setConfirmation] = useState<Confirmation | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const schemaInput = useRef<HTMLTextAreaElement>(null);
  const payloadInput = useRef<HTMLTextAreaElement>(null);
  const t = texts[lang];
  const fixture = project.fixtures.find(f => f.id === selected) ?? project.fixtures[0];
  const result = batch.results.find(r => r.id === fixture.id);
  const matches = batch.results.filter(r => project.fixtures.find(f => f.id === r.id)?.expected === r.status).length;
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);
  useEffect(() => {
    try { if (remember) localStorage.setItem(STORAGE, JSON.stringify(validateProject(project))); }
    catch { setNotice('storageFail'); }
  }, [project, remember]);
  const run = useCallback(() => {
    stop.current?.(); setBusy(true); setBatch({ results: [] });
    try { stop.current = startValidation(project, next => { setBatch(next); setBusy(false); stop.current = null; }); }
    catch { setBusy(false); setBatch({ schemaStatus: 'schema', schemaIssue: { code: 'worker', path: '/' }, results: [] }); }
  }, [project]);
  useEffect(() => {
    stop.current?.(); setBusy(false); setBatch({ results: [] });
    const timer = setTimeout(run, 500);
    return () => { clearTimeout(timer); stop.current?.(); };
  }, [run]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !dialog.current?.open) { event.preventDefault(); run(); } };
    window.addEventListener('keydown',onKey); return () => window.removeEventListener('keydown',onKey);
  }, [run]);
  useEffect(() => { if (help || confirmation) dialog.current?.showModal(); else dialog.current?.close(); }, [help,confirmation]);
  const patchFixture = (changes: Partial<typeof fixture>) => {
    const next = { ...project, fixtures: project.fixtures.map(f => f.id === fixture.id ? { ...f,...changes } : f) };
    if ((changes.payload !== undefined && (changes.payload.length > LIMITS.payloadBytes || bytes(changes.payload) > LIMITS.payloadBytes)) || bytes(JSON.stringify(next)) > LIMITS.projectBytes) { setNotice('inputLimit'); return; }
    setProject(next);
  };
  const patchSchema = (schema: string) => {
    const next = {...project,schema};
    if (schema.length > LIMITS.schemaBytes || bytes(schema) > LIMITS.schemaBytes || bytes(JSON.stringify(next)) > LIMITS.projectBytes) { setNotice('inputLimit'); return; }
    setProject(next);
  };
  const replace = (next: Project) => { setProject(next); setSelected(next.fixtures[0].id); setNotice(null); };
  const add = (duplicate = false) => {
    if (project.fixtures.length >= LIMITS.fixtures) { setNotice('limitFixtures'); return; }
    const id = crypto.randomUUID();
    const next = duplicate ? { ...fixture, id, name: `${fixture.name.slice(0,65)} · ${t.copySuffix}` } : { id, name: `${t.fixtureDefault} ${project.fixtures.length + 1}`, payload: '{}', expected: 'valid' as const };
    const updated = { ...project, fixtures: [...project.fixtures,next] };
    if (bytes(JSON.stringify(updated)) > LIMITS.projectBytes) {setNotice('inputLimit');return;}
    setProject(updated); setSelected(id);
  };
  const format = (kind: 'schema' | 'payload') => {
    try { const json = JSON.stringify(parseJson(kind === 'schema' ? project.schema : fixture.payload, kind === 'schema' ? LIMITS.schemaBytes : LIMITS.payloadBytes),null,2); if (kind === 'schema') patchSchema(json); else patchFixture({payload:json}); }
    catch { setNotice('formatFail'); }
  };
  const jump = (issue: Issue, schema = false) => {
    const editor = schema ? schemaInput.current : payloadInput.current; if (!editor) return;
    editor.focus();
    let range = locatePointer(editor.value,issue.path);
    if (issue.line) { const lines = editor.value.split('\n'); const start = lines.slice(0,issue.line - 1).join('\n').length + (issue.line > 1 ? 1 : 0) + (issue.column ?? 1) - 1; range = [start,start + 1]; }
    editor.setSelectionRange(...range);
    const preceding = editor.value.slice(0,range[0]).split('\n').length; editor.scrollTop = Math.max(0,(preceding - 3) * 24);
  };
  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > LIMITS.projectBytes) throw new Error('size');
      const next = importProject(await file.text());
      setConfirmation({ message: 'importReady', apply: () => { replace(next); setNotice('imported'); } });
    } catch { setNotice('importFail'); }
    if (importInput.current) importInput.current.value = '';
  };
  const canExport = !busy && !batch.schemaIssue && batch.results.length === project.fixtures.length && batch.results.every(r => ['valid','invalid'].includes(r.status));
  const handleExport = () => {
    if (!canExport) { setNotice('exportBlocked'); return; }
    try { download(exportSuite(project) as Uint8Array<ArrayBuffer>, 'shapecheck-tests.zip','application/zip'); setNotice('exported'); } catch { setNotice('exportBlocked'); }
  };
  const statusText = (status: Result['status'] | undefined) => status ? t[(status === 'schema' ? 'schemaStatus' : status) as TextKey] : t.pending;
  const issueCard = (issue: Issue, index: number, schema = false) => <li className="issue-card" key={`${issue.path}-${issue.code}-${index}`}>
    <div className="issue-top"><code className="pointer">{issue.path || t.root}</code><span className="rule-tag">{issue.code}</span></div>
    <p>{issueText(issue,lang)}</p>
    {issue.params?.type !== undefined && <p className="constraint">{t.constraint}: <code>{String(issue.params.type)}</code></p>}
    {issue.params?.limit !== undefined && <p className="constraint">{t.constraint}: <code>{String(issue.params.limit)}</code></p>}
    {issue.line && <p className="constraint">{t.line} {issue.line}, {t.column} {issue.column}</p>}
    <div className="issue-bottom">{issue.schemaPath && <code title={t.rulePath}>{issue.schemaPath}</code>}<button className="text-button" onClick={() => jump(issue,schema)}>{t.locate}<ChevronRight size={14}/></button></div>
  </li>;
  return <>
    <a className="skip-link" href="#schema-editor">{t.schema}</a>
    <header className="app-header"><div className="brand"><span className="brand-mark"><Braces size={23}/></span><span>shapecheck<span className="brand-dot">.</span></span><span className="version">01</span></div><div className="header-tools"><span className="local-label"><ShieldCheck size={14}/>{t.local}</span><select aria-label={t.language} value={lang} onChange={e => setLang(e.target.value as Language)}><option value="en">EN</option><option value="ru">RU</option></select><button className="icon-button" aria-label={t.theme} onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><a className="icon-button" href="https://github.com/MOYISEY/shapecheck" target="_blank" rel="noreferrer" aria-label={t.github}><Github size={18}/></a></div></header>
    <main>
      <section className="workspace-heading"><div><h1 className="eyebrow">{t.workspace}</h1><input className="project-title" aria-label={t.projectName} maxLength={80} value={project.name} onChange={e => setProject(p => ({...p,name:e.target.value}))}/><p className="subtle">{t.runHint}</p></div><div className="run-area"><div className={`suite-summary ${matches === project.fixtures.length ? 'good' : ''}`} aria-live="polite">{busy ? <><LoaderCircle className="spin" size={15}/>{t.checking}</> : <><span className="summary-number">{matches}<span>/{project.fixtures.length}</span></span>{t.matches}</>}</div>{busy ? <button className="primary" onClick={() => { stop.current?.(); stop.current = null; setBusy(false); setBatch({results:project.fixtures.map(f => ({id:f.id,status:'cancelled',issues:[]}))}); }}><X size={16}/>{t.cancel}</button> : <button className="primary" onClick={run}><Play size={15}/>{t.check}</button>}</div></section>
      <div className="project-toolbar"><div className="file-actions"><button onClick={() => { try { download(JSON.stringify(validateProject(project),null,2),'shapecheck-project.json','application/json'); setNotice('saved'); } catch { setNotice('importFail'); } }}><FileJson size={15}/>{t.save}</button><button onClick={() => importInput.current?.click()}><Upload size={15}/>{t.import}</button><button onClick={handleExport} aria-disabled={!canExport}><Download size={15}/>{t.export}</button><input ref={importInput} type="file" accept=".json,application/json" className="hidden" aria-label={t.import} onChange={e => void onImport(e.target.files?.[0])}/></div><div className="utility-actions"><button onClick={() => setConfirmation({message:'sampleConfirm',apply:() => replace(sampleProject())})}>{t.sample}</button><button onClick={() => setHelp(true)}><CircleHelp size={15}/>{t.help}</button></div></div>
      {notice && <div className="notice" role="status"><span>{t[notice]}</span><button className="icon-button" aria-label={t.close} onClick={() => setNotice(null)}><X size={16}/></button></div>}
      <div className="workbench"><aside className="fixture-panel" aria-label={t.fixtures}><div className="panel-heading"><h2>{t.fixtures}</h2><span className="count">{project.fixtures.length}</span></div><div className="fixture-list">{project.fixtures.map((f,index) => { const r = batch.results.find(r => r.id === f.id); const match = r?.status === f.expected; return <button key={f.id} className={`fixture-item ${f.id === fixture.id ? 'selected' : ''}`} onClick={() => setSelected(f.id)} aria-pressed={f.id === fixture.id}><span className="fixture-index">{String(index + 1).padStart(2,'0')}</span><span className="fixture-info"><strong>{f.name || t.fixtureDefault}</strong><span>{busy ? t.checking : statusText(r?.status)}</span></span><span className={`fixture-status ${r ? match ? 'good' : 'bad' : ''}`} aria-label={r ? match ? t.allPass : t.mismatch : t.pending}>{r ? match ? <Check size={15}/> : <AlertTriangle size={15}/> : <span>·</span>}</span></button>; })}</div><button className="add-fixture" onClick={() => add()} disabled={project.fixtures.length >= LIMITS.fixtures}><Plus size={16}/>{t.add}</button><div className="fixture-meta"><span>{t.local}</span><code>JSON → Schema → Result</code></div></aside>
        <section className="editor-panel schema-panel"><div className="panel-heading"><h2><span className="step">A</span>{t.schema}</h2><span className="pill">{t.draft}</span></div><div className="editor-meta"><span>{bytes(project.schema).toLocaleString(lang)} B / 64 KiB</span><button className="icon-button" title={t.format} aria-label={`${t.format}: ${t.schema}`} onClick={() => format('schema')}><AlignLeft size={16}/></button></div><textarea ref={schemaInput} id="schema-editor" className="code-editor" aria-label={t.schema} spellCheck={false} autoCapitalize="off" autoCorrect="off" value={project.schema} onChange={e => patchSchema(e.target.value)}/></section>
        <section className="editor-panel payload-panel"><div className="panel-heading"><h2><span className="step">B</span>{t.payload}</h2><div className="fixture-controls"><button className="icon-button" aria-label={t.duplicate} onClick={() => add(true)} disabled={project.fixtures.length >= LIMITS.fixtures}><Copy size={15}/></button><button className="icon-button" aria-label={t.delete} disabled={project.fixtures.length === 1} onClick={() => setConfirmation({message:'deleteConfirm',apply:() => { setProject(p => ({...p,fixtures:p.fixtures.filter(f => f.id !== fixture.id)})); setSelected(project.fixtures.find(f => f.id !== fixture.id)!.id); }})}><Trash2 size={15}/></button></div></div><div className="payload-settings"><input aria-label={t.rename} maxLength={80} value={fixture.name} onChange={e => patchFixture({name:e.target.value})}/><select aria-label={t.expect} value={fixture.expected} onChange={e => patchFixture({expected:e.target.value as 'valid' | 'invalid'})}><option value="valid">{t.expected}: {t.valid}</option><option value="invalid">{t.expected}: {t.invalid}</option></select></div><div className="editor-meta"><span>{bytes(fixture.payload).toLocaleString(lang)} B / 256 KiB</span><button className="icon-button" title={t.format} aria-label={`${t.format}: ${t.payload}`} onClick={() => format('payload')}><AlignLeft size={16}/></button></div><textarea ref={payloadInput} className="code-editor" aria-label={t.payload} spellCheck={false} autoCapitalize="off" autoCorrect="off" value={fixture.payload} onChange={e => patchFixture({payload:e.target.value})}/></section>
      </div>
      <section className="results-panel" aria-labelledby="results-title"><div className="panel-heading"><h2 id="results-title"><span className="step">C</span>{t.results}</h2><span className="subtle">{t.issueCap}</span></div><div className="result-content" aria-live="polite" aria-busy={busy}>{busy ? <div className="result-empty"><LoaderCircle className="spin" size={20}/><p>{t.checkingHint}</p></div> : batch.schemaIssue ? <><div className="result-banner bad"><AlertTriangle size={18}/><strong>{statusText(batch.schemaStatus)}</strong></div><ul className="issue-list">{issueCard(batch.schemaIssue,0,true)}</ul></> : result ? <><div className={`result-banner ${result.status === fixture.expected ? 'good' : 'bad'}`}>{result.status === fixture.expected ? <Check size={19}/> : <AlertTriangle size={19}/>}<strong>{result.status === 'valid' ? t.noErrors : result.status === 'invalid' && fixture.expected === 'invalid' ? t.expectedInvalid : statusText(result.status)}</strong><span>{t.expected}: {t[fixture.expected]}</span>{result.status !== fixture.expected && <span className="mismatch-label">{t.mismatch}</span>}</div>{result.issues.length > 0 && <ul className="issue-list">{result.issues.map((issue,index) => issueCard(issue,index))}</ul>}{result.status !== fixture.expected && <p className="result-note">{t.mismatchHint}</p>}</> : <div className="result-empty"><Braces size={20}/><p>{t.emptyErrors}</p></div>}</div></section>
      <footer className="workspace-footer"><div className="storage-control"><label><input type="checkbox" checked={remember} onChange={e => {setRemember(e.target.checked);if (!e.target.checked) {try {localStorage.removeItem(STORAGE);}catch {setNotice('storageFail');}}}}/>{t.persist}</label><span>{t.persistHint}</span></div><button className="clear-button" onClick={() => setConfirmation({message:'clearConfirm',apply:() => { setRemember(false); replace(emptyProject()); try { localStorage.removeItem(STORAGE); } catch { setNotice('storageFail'); } }})}><Trash2 size={14}/>{t.clear}</button></footer><div className="credits"><span>{t.footer}</span><span>AJV 8.20.0 · draft-07</span></div>
    </main>
    <dialog ref={dialog} onCancel={() => { setHelp(false); setConfirmation(null); }} aria-labelledby="dialog-title"><div className="dialog-heading"><h2 id="dialog-title">{help ? t.helpTitle : t.workspace}</h2><button className="icon-button" aria-label={t.close} onClick={() => {setHelp(false);setConfirmation(null);}}><X size={20}/></button></div>{help ? <div className="help-content"><p>{t.helpIntro}</p><h3>{t.schema}</h3><p>{t.helpSchema}</p><h3>{t.local}</h3><p>{t.helpPrivacy}</p><h3>{t.help}</h3><p>{t.helpLimits}</p><p>{t.helpSafety}</p><h3>{t.export}</h3><p>{t.helpExport}</p><code>node --test test.mjs</code></div> : confirmation && <><p>{t[confirmation.message]}</p><div className="dialog-actions"><button onClick={() => setConfirmation(null)}>{t.dismiss}</button><button className="primary" onClick={() => {confirmation.apply();setConfirmation(null);}}>{t.confirm}</button></div></>}</dialog>
  </>;
}
export default App;
