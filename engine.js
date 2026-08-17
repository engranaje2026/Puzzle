// Inicialización del cliente Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function loadTokens(){
  const { data, error } = await supabase.from('pieces').select('*').order('created_at', { ascending:true });
  if(error){ console.error(error); return []; }
  return data;
}

async function insertPiece(name, token){
  const { error } = await supabase.from('pieces').insert({ token, name });
  if(error){ console.error(error); return false; }
  return true;
}

// Canje atómico: valida y marca como usado en una sola operación
async function redeemToken(token){
  const { data, error } = await supabase
    .from('pieces')
    .update({ used: true, used_at: new Date().toISOString() })
    .eq('token', token)
    .eq('used', false)
    .select();

  if(error){ console.error(error); return { ok: false, reason: 'error' }; }
  
  if(!data || !data.length){
    const { data: existing } = await supabase.from('pieces').select('*').eq('token', token).maybeSingle();
    if(!existing) return { ok: false, reason: 'not_found' };
    return { ok: false, reason: 'used', name: existing.name };
  }
  return { ok: true, name: data[0].name };
}

// Generación visual del engrane con QR embebido
function gearPath(cx, cy, rOuter, rInner, teeth){
  let d = '';
  const step = Math.PI * 2 / teeth;
  for(let i = 0; i < teeth; i++){
    const a0 = i * step, a1 = a0 + step * 0.35, a2 = a0 + step * 0.5, a3 = a0 + step * 0.85;
    const pts = [
      [cx + rInner * Math.cos(a0), cy + rInner * Math.sin(a0)],
      [cx + rOuter * Math.cos(a1), cy + rOuter * Math.sin(a1)],
      [cx + rOuter * Math.cos(a2), cy + rOuter * Math.sin(a2)],
      [cx + rInner * Math.cos(a3), cy + rInner * Math.sin(a3)],
    ];
    pts.forEach((p, j)=>{ d += (i === 0 && j === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1) + ' '; });
  }
  return d + 'Z';
}

function drawGearPiece(canvas, token, label, done){
  const ctx = canvas.getContext('2d');
  canvas.width = 240; 
  canvas.height = 260;
  const cx = 120, cy = 110;
  const path = new Path2D(gearPath(cx, cy, 96, 80, 14));
  const grad = ctx.createLinearGradient(0, 0, 240, 220);
  grad.addColorStop(0, '#1a2440'); 
  grad.addColorStop(1, '#0c1120');
  ctx.fillStyle = grad;
  ctx.fill(path);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#3a4568';
  ctx.stroke(path);

  const host = document.createElement('div');
  host.style.display = 'none';
  document.body.appendChild(host);
  new QRCode(host, { text: token, width: 108, height: 108, colorDark: '#0c1120', colorLight: '#e9ebf1' });

  setTimeout(()=>{
    const qrCanvas = host.querySelector('canvas');
    if(qrCanvas){
      const white = document.createElement('canvas');
      white.width = 122; 
      white.height = 122;
      const wctx = white.getContext('2d');
      wctx.fillStyle = '#eceef3';
      wctx.fillRect(0, 0, 122, 122);
      wctx.drawImage(qrCanvas, 7, 7, 108, 108);
      ctx.drawImage(white, cx - 61, cy - 61, 122, 122);
    }
    ctx.fillStyle = '#c6a15b';
    ctx.font = '600 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, 245);
    host.remove();
    if(done) done();
  }, 60);
}

// Lectura de QR desde archivo cargado
function handleUploadedFile(file, onToken, onFail){
  const img = new Image();
  const reader = new FileReader();
  reader.onload = ()=>{
    img.onload = ()=>{
      const c = document.createElement('canvas');
      c.width = img.width; 
      c.height = img.height;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
      const data = cx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(data.data, c.width, c.height);
      if(code) onToken(code.data);
      else onFail();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
