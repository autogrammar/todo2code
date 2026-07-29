export function diffUiHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>todo2code · Intent Diff</title>
  <style>
    :root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#020617;color:#e2e8f0}
    *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 0,#172554 0,transparent 38%),#020617;min-height:100vh}
    main{width:min(1480px,96vw);margin:auto;padding:34px 0 64px}header{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:24px}
    h1{font-size:clamp(28px,4vw,52px);margin:0;letter-spacing:-.04em}.eyebrow{color:#38bdf8;text-transform:uppercase;letter-spacing:.18em;font-size:12px;font-weight:800}
    .sub{max-width:720px;color:#94a3b8;line-height:1.6}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.panel{background:#0f172acc;border:1px solid #334155;border-radius:16px;padding:18px;box-shadow:0 20px 60px #0005}
    .panel h2{margin:0 0 12px;font-size:16px}textarea{width:100%;min-height:230px;resize:vertical;border:1px solid #334155;border-radius:10px;background:#020617;color:#cbd5e1;padding:12px;font:12px ui-monospace,monospace}
    input[type=file],input[type=password],.panel input:not([type=file]){width:100%;margin-top:10px;color:#94a3b8}input[type=password],.panel input:not([type=file]){background:#020617;border:1px solid #334155;border-radius:8px;padding:10px;color:#e2e8f0}
    .actions{display:flex;align-items:center;gap:12px;margin:18px 0;flex-wrap:wrap}button{border:0;border-radius:10px;background:#38bdf8;color:#082f49;font-weight:800;padding:12px 20px;cursor:pointer}button:disabled{opacity:.55;cursor:wait}
    .status{color:#94a3b8;font:13px ui-monospace,monospace}.error{color:#fca5a5;white-space:pre-wrap}.result{display:none}.result.visible{display:block}.metrics{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}.metric{min-width:130px;background:#111827;border:1px solid #334155;border-radius:10px;padding:12px}.metric b{display:block;font-size:24px}.metric span{color:#94a3b8;font-size:12px}
    #svg-host{overflow:auto;border-radius:14px;background:#0f172a}#svg-host svg{display:block;width:100%;height:auto}.fingerprint{word-break:break-all;color:#64748b;font:11px ui-monospace,monospace;margin-top:12px}
    @media(max-width:850px){header{display:block}.grid{grid-template-columns:1fr}}
  </style>
</head>
<body><main>
  <header><div><div class="eyebrow">Intent Evidence Runtime</div><h1>Graph diff, made visible.</h1></div><p class="sub">Load two <code>t2c.graph/v1</code> files. The backend computes a deterministic DSL diff and returns an accessible SVG generated without browser or rendering dependencies.</p></header>
  <section class="grid">
    <article class="panel"><h2>Before graph</h2><textarea id="before" spellcheck="false" placeholder="Paste intent.graph.json"></textarea><input id="before-file" type="file" accept="application/json,.json"><input id="before-path" placeholder="Or server path under T2C_ROOT"></article>
    <article class="panel"><h2>After graph</h2><textarea id="after" spellcheck="false" placeholder="Paste intent.graph.json"></textarea><input id="after-file" type="file" accept="application/json,.json"><input id="after-path" placeholder="Or server path under T2C_ROOT"></article>
  </section>
  <div class="actions"><button id="compare">Compare graphs</button><span id="status" class="status">Ready</span></div>
  <details class="panel" style="margin-bottom:16px"><summary>Bearer token (only when T2C_A2A_TOKEN is enabled)</summary><input id="token" type="password" autocomplete="off" placeholder="Optional token"></details>
  <p id="error" class="error"></p>
  <section id="result" class="result panel"><div id="metrics" class="metrics"></div><div id="svg-host"></div><div id="fingerprint" class="fingerprint"></div></section>
</main><script>
const byId=(id)=>document.getElementById(id);
for(const side of ['before','after']) byId(side+'-file').addEventListener('change',async(event)=>{const file=event.target.files?.[0];if(file)byId(side).value=await file.text()});
byId('compare').addEventListener('click',async()=>{
  const button=byId('compare'),status=byId('status'),error=byId('error'),result=byId('result');
  button.disabled=true;status.textContent='Computing diff…';error.textContent='';result.classList.remove('visible');
  try{
    const beforePath=byId('before-path').value.trim(),afterPath=byId('after-path').value.trim(),token=byId('token').value.trim();
    const payload=beforePath&&afterPath?{before:beforePath,after:afterPath,includeSvg:true}:{beforeGraph:JSON.parse(byId('before').value),afterGraph:JSON.parse(byId('after').value),includeSvg:true};
    const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
    const response=await fetch('/api/diff',{method:'POST',headers,body:JSON.stringify(payload)});
    const responsePayload=await response.json();if(!response.ok)throw new Error(responsePayload.error||('HTTP '+response.status));
    const summary=responsePayload.diff.summary;
    byId('metrics').innerHTML=[['Records +',summary.recordsAdded],['Records −',summary.recordsRemoved],['Changed',summary.recordsChanged],['Relations +',summary.relationsAdded],['Relations −',summary.relationsRemoved]].map(([label,value])=>'<div class="metric"><b>'+value+'</b><span>'+label+'</span></div>').join('');
    byId('svg-host').innerHTML=responsePayload.svg;byId('fingerprint').textContent='diff fingerprint: '+responsePayload.diff.fingerprint;result.classList.add('visible');status.textContent='Complete';
  }catch(cause){error.textContent=cause instanceof Error?cause.message:String(cause);status.textContent='Failed'}finally{button.disabled=false}
});
</script></body></html>`;
}
