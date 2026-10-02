// JSON.parse errors vary by browser. This bounded grammar walk finds a safe
// location without returning any of the input in its diagnostic.
export function syntaxLocation(text: string): { line: number; column: number } {
  let at=0;
  const bad=():never=>{throw new Error('syntax');};
  const ws=()=>{while(at<text.length&&/[\t\n\r ]/.test(text[at]))at++;};
  // JSON explicitly excludes unescaped control characters from strings.
  // eslint-disable-next-line no-control-regex
  const string=()=>{const match=/^"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/.exec(text.slice(at));if(!match)bad();at+=match![0].length;};
  const value=(depth:number)=>{
    if(depth>32)bad();ws();
    if(text[at]==='{'){at++;ws();if(text[at]!=='}')while(at<text.length){string();ws();if(text[at]!==':')bad();at++;value(depth+1);ws();if(text[at]!==',')break;at++;ws();}if(text[at]!=='}')bad();at++;}
    else if(text[at]==='['){at++;ws();if(text[at]!==']')while(at<text.length){value(depth+1);ws();if(text[at]!==',')break;at++;ws();}if(text[at]!==']')bad();at++;}
    else if(text[at]==='"')string();
    else {const match=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));if(!match)bad();at+=match![0].length;}
  };
  try{value(0);ws();if(at!==text.length)bad();}catch{/* at points to the first unaccepted token. */}
  const lines=text.slice(0,at).split('\n');return{line:lines.length,column:lines.at(-1)!.length+1};
}
