// Tokenize valid JSON to find the exact JSON Pointer, including repeated field names
// in nested objects and array entries. Missing fields select their containing object.
export function locatePointer(text: string, pointer: string): [number,number] {
  const positions = new Map<string,[number,number]>(); const values = new Map<string,[number,number]>(); let at = 0;
  const ws = () => { while (/\s/.test(text[at] ?? '') && at < text.length) at++; };
  const string = () => { const start=at++; while(at < text.length) { if(text[at]==='\\') {at+=2;continue;} if(text[at++]==='"')break; } return {start,end:at,value:JSON.parse(text.slice(start,at)) as string}; };
  const value = (path:string,depth:number) => {
    if(depth>32) throw new Error('depth'); ws(); const start=at;
    if(text[at]==='{') {
      at++;ws(); if(text[at]!=='}') while(at<text.length) { const key=string();ws();if(text[at++]!==':')throw new Error('json'); const child=path+'/'+key.value.replace(/~/g,'~0').replace(/\//g,'~1'); value(child,depth+1);positions.set(child,[key.start,key.end]);ws();if(text[at]!==',')break;at++;ws(); }
      if(text[at++]!=='}')throw new Error('json');
    } else if(text[at]==='[') {
      at++;ws();let index=0;if(text[at]!==']')while(at<text.length){value(path+'/'+index++,depth+1);ws();if(text[at]!==',')break;at++;ws();}if(text[at++]!==']')throw new Error('json');
    } else if(text[at]==='"') string(); else {while(at<text.length&&!/[\s,}\]]/.test(text[at]))at++;if(at===start)throw new Error('json');}
    values.set(path,[start,at]);if(!positions.has(path))positions.set(path,[start,at]);
  };
  try {value('',0);return positions.get(pointer)??values.get(pointer.slice(0,pointer.lastIndexOf('/')))??[0,0];}catch{return [0,0];}
}
