import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  CONFIGURACIÓN SUPABASE
//  Reemplaza estos dos valores con los tuyos (ver GUÍA paso 3).
// ============================================================
const SUPABASE_URL = "https://rfychqdssqukybqtdwtr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Ib1riPJwitG5PCyCog9HPg_lN8EiTYU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "vouchers"; // carpeta de fotos en Supabase Storage

// ============ MARCA LEÓN PT ============
const C = {
  negro: "#1A1A1A", dorado: "#9A7B0A", doradoClaro: "#C9A227",
  crema: "#F5EFD9", blanco: "#FFFFFF", gris: "#6B6455",
  linea: "#E4DCC3", ok: "#3A7D44", alerta: "#C7791B", peligro: "#B3382C",
};

// ============ PRESUPUESTO APROBADO — CONTRATO 10212 (costo directo sin IGV) ============
const PARTIDAS = [
  { id: "topo", nombre: "1. Topografía", techo: 14500.0 },
  { id: "mant", nombre: "2. Mantenimiento trochas", techo: 61593.89 },
  { id: "apert", nombre: "3. Apertura accesos", techo: 89252.6 },
  { id: "plat", nombre: "4. Plataformas", techo: 46451.92 },
  { id: "pers", nombre: "5. Personal y vehículos", techo: 380087.5 },
  { id: "movil", nombre: "6. Movilización / Desmov.", techo: 18000.0 },
  { id: "gg", nombre: "7. Gastos Generales", techo: 201572.17 },
];
const TECHO_TOTAL = PARTIDAS.reduce((s, p) => s + p.techo, 0);
const COMPROBANTES = ["Factura", "Boleta", "Recibo por honorarios", "Voucher / transferencia", "Sin comprobante"];
const FUENTES = ["Caja chica", "Cuenta empresa", "Gerente (personal)"];

// ============ UTILIDADES ============
const fmt = (n) => "S/ " + (Number(n) || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtFecha = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); const M = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"]; return `${d} ${M[+m-1]} ${y.slice(2)}`; };
const mesDeISO = (iso) => (iso ? iso.slice(0, 7) : "");
const nombreMes = (ym) => { if (!ym) return ""; const M=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]; const [y,m]=ym.split("-"); return `${M[+m-1]} ${y}`; };
const sumaDias = (iso, dias) => { const [y,m,d]=iso.split("-").map(Number); const dt=new Date(y,m-1,d+dias); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`; };

const comprimirImagen = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1000; let { width, height } = img;
      if (width > MAX || height > MAX) { const r = Math.min(MAX/width, MAX/height); width = Math.round(width*r); height = Math.round(height*r); }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.7);
    };
    img.onerror = reject; img.src = e.target.result;
  };
  reader.onerror = reject; reader.readAsDataURL(file);
});

// ============ UI AUXILIAR ============
const Etiqueta = ({ children }) => (
  <label style={{ display:"block", fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:C.gris, marginBottom:5 }}>{children}</label>
);
const estiloInput = { width:"100%", padding:"11px 12px", fontSize:15, border:`1.5px solid ${C.linea}`, borderRadius:8, background:C.blanco, color:C.negro, outline:"none", boxSizing:"border-box", fontFamily:"inherit" };
const estiloBoton = (p) => ({ padding:"11px 16px", borderRadius:9, border: p?"none":`1.5px solid ${C.dorado}`, background: p?C.dorado:C.blanco, color: p?"#fff":C.dorado, fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit" });
const btnLink = (color) => ({ background:"none", border:"none", color, fontSize:13, fontWeight:700, cursor:"pointer", padding:0, textDecoration:"underline" });
const tituloSeccion = { fontSize:11, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:"#6B6455", marginBottom:10 };
const cajaResumen = { background:"#FFFFFF", border:"1px solid #E4DCC3", borderRadius:10, padding:"10px 8px", textAlign:"center" };
const etqResumen = { fontSize:10, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"#6B6455", marginBottom:4 };

function BarraTecho({ gastado, techo }) {
  const pct = techo > 0 ? (gastado/techo)*100 : 0;
  const color = pct>=90?C.peligro:pct>=70?C.alerta:C.ok;
  return (
    <div style={{ position:"relative", height:14, background:C.crema, borderRadius:7, overflow:"hidden", border:`1px solid ${C.linea}` }}>
      <div style={{ width:`${Math.min(pct,100)}%`, height:"100%", background:color, borderRadius:7, transition:"width 0.5s ease" }} />
      {pct>100 && <div style={{ position:"absolute", inset:0, background:"repeating-linear-gradient(45deg,transparent,transparent 6px,rgba(0,0,0,0.15) 6px,rgba(0,0,0,0.15) 12px)" }} />}
    </div>
  );
}

// ============ APP ============
export default function ControlGastosMara() {
  const [tab, setTab] = useState("registrar");
  const [gastos, setGastos] = useState([]);
  const [ingresos, setIngresos] = useState([]);
  const [cc, setCC] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState(null);
  const [fotoModal, setFotoModal] = useState(null);

  const mostrarAviso = (txt, tipo="ok") => { setAviso({ txt, tipo }); setTimeout(() => setAviso(null), 3200); };

  // ---- Carga desde Supabase ----
  const recargar = async () => {
    const [g, i, c] = await Promise.all([
      supabase.from("gastos").select("*").order("fecha", { ascending: false }),
      supabase.from("ingresos").select("*").order("fecha", { ascending: false }),
      supabase.from("caja_chica").select("*").order("fecha", { ascending: false }),
    ]);
    if (!g.error) setGastos(g.data || []);
    if (!i.error) setIngresos(i.data || []);
    if (!c.error) setCC(c.data || []);
    setCargando(false);
  };

  useEffect(() => {
    recargar();
    // Refresco en vivo: el gerente ve cambios sin recargar
    const canal = supabase.channel("cambios-mara")
      .on("postgres_changes", { event:"*", schema:"public", table:"gastos" }, recargar)
      .on("postgres_changes", { event:"*", schema:"public", table:"ingresos" }, recargar)
      .on("postgres_changes", { event:"*", schema:"public", table:"caja_chica" }, recargar)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  // ---- Cálculos ----
  const gastadoPorPartida = {};
  PARTIDAS.forEach((p) => (gastadoPorPartida[p.id] = 0));
  gastos.forEach((g) => { if (gastadoPorPartida[g.partida] !== undefined) gastadoPorPartida[g.partida] += Number(g.monto) || 0; });
  const gastadoTotal = Object.values(gastadoPorPartida).reduce((a, b) => a + b, 0);
  const hoy = hoyISO();
  const gastosHoy = gastos.filter((g) => g.fecha === hoy);
  const ccAsignado = cc.reduce((s, a) => s + (Number(a.monto) || 0), 0);
  const ccGastado = gastos.filter((g) => g.fuente === "Caja chica").reduce((s, g) => s + Number(g.monto), 0);
  const ccSaldo = ccAsignado - ccGastado;
  const ingresosCobrados = ingresos.filter((v) => v.cobrada).reduce((s, v) => s + Number(v.monto), 0);
  const ingresosPorCobrar = ingresos.filter((v) => !v.cobrada).reduce((s, v) => s + Number(v.monto), 0);

  // ============ REGISTRAR ============
  function FormRegistro() {
    const [f, setF] = useState({ fecha: hoyISO(), partida:"", desc:"", prov:"", monto:"", comp:COMPROBANTES[0], fuente:FUENTES[1] });
    const [fotoFile, setFotoFile] = useState(null);
    const [fotoPrev, setFotoPrev] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const fileRef = useRef(null); const camRef = useRef(null);

    const onFoto = async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      try { const blob = await comprimirImagen(file); setFotoFile(blob); setFotoPrev(URL.createObjectURL(blob)); }
      catch { mostrarAviso("No se pudo procesar la imagen.", "err"); }
      e.target.value = "";
    };

    const guardar = async () => {
      if (!f.partida) return mostrarAviso("Selecciona la partida.", "err");
      const monto = parseFloat(f.monto);
      if (!monto || monto <= 0) return mostrarAviso("Ingresa un monto válido.", "err");
      if (!f.desc.trim()) return mostrarAviso("Describe el gasto.", "err");
      setGuardando(true);
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      let foto_url = null;
      if (fotoFile) {
        const ruta = `${id}.jpg`;
        const up = await supabase.storage.from(BUCKET).upload(ruta, fotoFile, { contentType:"image/jpeg" });
        if (!up.error) { const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta); foto_url = data.publicUrl; }
        else mostrarAviso("La foto no se subió; el gasto se guarda sin foto.", "err");
      }
      const { error } = await supabase.from("gastos").insert({
        id, fecha:f.fecha, partida:f.partida, descripcion:f.desc.trim(), proveedor:f.prov.trim(),
        monto, comprobante:f.comp, fuente:f.fuente, foto_url,
      });
      setGuardando(false);
      if (error) return mostrarAviso("Error al guardar. Revisa tu conexión.", "err");
      setF({ fecha:hoyISO(), partida:"", desc:"", prov:"", monto:"", comp:COMPROBANTES[0], fuente:FUENTES[1] });
      setFotoFile(null); setFotoPrev(null);
      const p = PARTIDAS.find((x) => x.id === f.partida);
      const nuevoAcum = gastadoPorPartida[f.partida] + monto;
      const pct = (nuevoAcum / p.techo) * 100;
      if (pct >= 100) mostrarAviso(`⚠ ${p.nombre} SUPERÓ su techo (${pct.toFixed(0)}%)`, "err");
      else if (pct >= 90) mostrarAviso(`⚠ Guardado. ${p.nombre} va al ${pct.toFixed(0)}% del techo`, "err");
      else mostrarAviso("Gasto guardado ✓");
    };

    const partidaSel = PARTIDAS.find((x) => x.id === f.partida);

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {gastosHoy.length === 0 && (
          <div style={{ background:"#FFF6E5", border:`1.5px solid ${C.alerta}`, borderRadius:10, padding:"10px 14px", fontSize:13.5, color:"#7a4d10" }}>
            <b>Aún no registras gastos hoy.</b> Hazlo apenas salga el voucher — toma 15 segundos.
          </div>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div><Etiqueta>Fecha del gasto</Etiqueta>
            <input type="date" value={f.fecha} max={hoyISO()} onChange={(e)=>setF({...f,fecha:e.target.value})} style={estiloInput}/></div>
          <div><Etiqueta>Monto (S/)</Etiqueta>
            <input type="number" inputMode="decimal" placeholder="0.00" value={f.monto} onChange={(e)=>setF({...f,monto:e.target.value})} style={{...estiloInput,fontSize:18,fontWeight:700}}/></div>
        </div>
        <div><Etiqueta>Partida presupuestal</Etiqueta>
          <select value={f.partida} onChange={(e)=>setF({...f,partida:e.target.value})} style={estiloInput}>
            <option value="">— Selecciona —</option>
            {PARTIDAS.map((p)=><option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          {partidaSel && <div style={{ fontSize:12.5, color:C.gris, marginTop:5 }}>Disponible: <b style={{color:C.negro}}>{fmt(partidaSel.techo - gastadoPorPartida[partidaSel.id])}</b> de {fmt(partidaSel.techo)}</div>}
        </div>
        <div><Etiqueta>Descripción</Etiqueta>
          <input type="text" placeholder="Ej: Diesel 50 gal para CAT 336" value={f.desc} onChange={(e)=>setF({...f,desc:e.target.value})} style={estiloInput}/></div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div><Etiqueta>Proveedor (opcional)</Etiqueta>
            <input type="text" placeholder="Ej: Grifo Mara" value={f.prov} onChange={(e)=>setF({...f,prov:e.target.value})} style={estiloInput}/></div>
          <div><Etiqueta>Comprobante</Etiqueta>
            <select value={f.comp} onChange={(e)=>setF({...f,comp:e.target.value})} style={estiloInput}>
              {COMPROBANTES.map((c)=><option key={c}>{c}</option>)}
            </select></div>
        </div>
        <div><Etiqueta>Pagado con</Etiqueta>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {FUENTES.map((fu)=>(
              <button key={fu} onClick={()=>setF({...f,fuente:fu})} style={{ padding:"10px 6px", borderRadius:8, border:`1.5px solid ${f.fuente===fu?C.dorado:C.linea}`, background:f.fuente===fu?"#FBF4DE":C.blanco, color:f.fuente===fu?C.dorado:C.gris, fontWeight:700, fontSize:12.5, cursor:"pointer", fontFamily:"inherit" }}>{fu}</button>
            ))}
          </div>
          {f.fuente==="Caja chica" && <div style={{ fontSize:12.5, marginTop:5, color: ccSaldo<=0?C.peligro:C.gris }}>Saldo caja chica: <b style={{color: ccSaldo<=0?C.peligro:C.negro}}>{fmt(ccSaldo)}</b></div>}
        </div>
        <div><Etiqueta>Foto del voucher (opcional)</Etiqueta>
          <input ref={camRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={onFoto}/>
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={onFoto}/>
          {fotoPrev ? (
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <img src={fotoPrev} alt="voucher" style={{ width:84, height:84, objectFit:"cover", borderRadius:8, border:`2px solid ${C.dorado}` }}/>
              <button onClick={()=>{setFotoFile(null);setFotoPrev(null);}} style={{...estiloBoton(false),padding:"8px 14px"}}>Quitar foto</button>
            </div>
          ) : (
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>camRef.current?.click()} style={{...estiloBoton(false),flex:1}}>📷 Tomar foto</button>
              <button onClick={()=>fileRef.current?.click()} style={{...estiloBoton(false),flex:1}}>🖼 Subir imagen</button>
            </div>
          )}
        </div>
        <button onClick={guardar} disabled={guardando} style={{...estiloBoton(true), padding:"15px", fontSize:16, opacity:guardando?0.6:1}}>{guardando?"Guardando...":"Guardar gasto"}</button>
        <div style={{ fontSize:12, color:C.gris, lineHeight:1.5 }}>Para el aviso diario, crea un evento recurrente 8:00 pm en Google Calendar: <b>"Registrar gastos Mara"</b>.</div>
      </div>
    );
  }

  // ============ GASTOS ============
  function ListaGastos() {
    const [fPart, setFPart] = useState(""); const [fMes, setFMes] = useState(""); const [fFuente, setFFuente] = useState("");
    const meses = [...new Set(gastos.map((g)=>mesDeISO(g.fecha)))].sort().reverse();
    const filtrados = gastos.filter((g)=>(!fPart||g.partida===fPart)&&(!fMes||mesDeISO(g.fecha)===fMes)&&(!fFuente||(g.fuente||"Cuenta empresa")===fFuente));
    const totalFiltrado = filtrados.reduce((s,g)=>s+Number(g.monto),0);

    const eliminar = async (g) => {
      if (!window.confirm(`¿Eliminar este gasto?\n${g.descripcion} — ${fmt(g.monto)}`)) return;
      await supabase.from("gastos").delete().eq("id", g.id);
      if (g.foto_url) { try { await supabase.storage.from(BUCKET).remove([`${g.id}.jpg`]); } catch {} }
      mostrarAviso("Gasto eliminado.");
    };

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <select value={fPart} onChange={(e)=>setFPart(e.target.value)} style={estiloInput}>
            <option value="">Todas las partidas</option>{PARTIDAS.map((p)=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
          <select value={fMes} onChange={(e)=>setFMes(e.target.value)} style={estiloInput}>
            <option value="">Todos los meses</option>{meses.map((m)=><option key={m} value={m}>{nombreMes(m)}</option>)}</select>
        </div>
        <select value={fFuente} onChange={(e)=>setFFuente(e.target.value)} style={estiloInput}>
          <option value="">Todas las fuentes de pago</option>{FUENTES.map((fu)=><option key={fu}>{fu}</option>)}</select>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"4px 2px" }}>
          <span style={{ fontSize:13, color:C.gris }}>{filtrados.length} gasto{filtrados.length!==1?"s":""}</span>
          <span style={{ fontSize:17, fontWeight:800 }}>{fmt(totalFiltrado)}</span>
        </div>
        {filtrados.length===0 && <div style={{ textAlign:"center", padding:"40px 20px", color:C.gris, fontSize:14 }}>No hay gastos{fPart||fMes||fFuente?" con estos filtros":" todavía"}.</div>}
        {filtrados.map((g)=>{
          const p = PARTIDAS.find((x)=>x.id===g.partida);
          const fu = g.fuente || "Cuenta empresa";
          return (
            <div key={g.id} style={{ background:C.blanco, border:`1px solid ${C.linea}`, borderRadius:10, padding:"12px 14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:14.5, wordBreak:"break-word" }}>{g.descripcion}</div>
                  <div style={{ fontSize:12.5, color:C.gris, marginTop:3 }}>{fmtFecha(g.fecha)} · {p?p.nombre.replace(/^\d+\. /,""):g.partida}{g.proveedor?` · ${g.proveedor}`:""} · {g.comprobante}</div>
                  <span style={{ display:"inline-block", marginTop:5, padding:"2px 9px", borderRadius:12, fontSize:11, fontWeight:700, background: fu==="Caja chica"?"#FBF4DE":fu==="Gerente (personal)"?"#EEE9FA":"#EAF1F7", color: fu==="Caja chica"?C.dorado:fu==="Gerente (personal)"?"#5B4A9E":"#2C5A7A" }}>{fu}</span>
                </div>
                <div style={{ fontWeight:800, fontSize:15.5, whiteSpace:"nowrap" }}>{fmt(g.monto)}</div>
              </div>
              <div style={{ display:"flex", gap:14, marginTop:8 }}>
                {g.foto_url && <button onClick={()=>setFotoModal(g.foto_url)} style={btnLink(C.dorado)}>Ver voucher</button>}
                <button onClick={()=>eliminar(g)} style={btnLink(C.peligro)}>Eliminar</button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ============ TECHOS ============
  function VistaTechos() {
    const pctTotal = (gastadoTotal/TECHO_TOTAL)*100;
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ background:C.negro, borderRadius:12, padding:"18px 16px", color:C.crema }}>
          <div style={{ fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:C.doradoClaro, fontWeight:700 }}>Costo directo ejecutado — Contrato 10212</div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", margin:"8px 0 10px" }}>
            <span style={{ fontSize:26, fontWeight:800 }}>{fmt(gastadoTotal)}</span>
            <span style={{ fontSize:13, opacity:0.8 }}>de {fmt(TECHO_TOTAL)}</span>
          </div>
          <BarraTecho gastado={gastadoTotal} techo={TECHO_TOTAL}/>
          <div style={{ fontSize:13, marginTop:8 }}>{pctTotal.toFixed(1)}% del presupuesto · Restante: <b>{fmt(TECHO_TOTAL-gastadoTotal)}</b></div>
        </div>
        {PARTIDAS.map((p)=>{
          const g = gastadoPorPartida[p.id]; const pct = (g/p.techo)*100;
          const color = pct>=90?C.peligro:pct>=70?C.alerta:C.ok;
          return (
            <div key={p.id} style={{ background:C.blanco, border:`1px solid ${C.linea}`, borderRadius:10, padding:"13px 14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
                <span style={{ fontWeight:700, fontSize:14 }}>{p.nombre}</span>
                <span style={{ fontWeight:800, fontSize:13.5, color }}>{pct.toFixed(0)}%</span>
              </div>
              <BarraTecho gastado={g} techo={p.techo}/>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, color:C.gris, marginTop:6 }}>
                <span>Gastado: {fmt(g)}</span>
                <span>Queda: <b style={{ color: p.techo-g<0?C.peligro:C.negro }}>{fmt(p.techo-g)}</b></span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ============ CAJA ============
  function VistaCaja() {
    const [nv, setNv] = useState({ fecha:hoyISO(), monto:"", nota:"" });
    const [na, setNa] = useState({ fecha:hoyISO(), monto:"", nota:"" });
    const d = new Date(); const y=d.getFullYear(), m=d.getMonth();
    const ultimoDia = new Date(y,m+1,0).getDate(); const diaHoy=d.getDate();
    const mesActual = hoyISO().slice(0,7);
    const gastoMesActual = gastos.filter((g)=>mesDeISO(g.fecha)===mesActual).reduce((s,g)=>s+Number(g.monto),0);
    const hitos = [];
    if (diaHoy<=20) hitos.push({ f:`${y}-${String(m+1).padStart(2,"0")}-20`, t:"Corte valorizaciones de proveedores" });
    hitos.push({ f:`${y}-${String(m+1).padStart(2,"0")}-${String(ultimoDia).padStart(2,"0")}`, t:"Pago de planilla (fin de mes)" });
    const prox = new Date(y,m+1,1);
    hitos.push({ f:`${prox.getFullYear()}-${String(prox.getMonth()+1).padStart(2,"0")}-20`, t:"Corte valorizaciones de proveedores" });
    const cobroPendiente = ingresos.filter((v)=>!v.cobrada).reduce((s,v)=>s+Number(v.monto),0);
    const planillaEstimada = 380087.5/5;
    const capitalNecesario = Math.max(0, gastoMesActual + planillaEstimada - cobroPendiente);

    const agregarIngreso = async () => {
      const monto = parseFloat(nv.monto); if (!monto||monto<=0) return mostrarAviso("Ingresa el monto.", "err");
      const { error } = await supabase.from("ingresos").insert({ id:Date.now().toString(36), fecha:nv.fecha, monto, nota:nv.nota.trim(), cobrada:false });
      if (error) return mostrarAviso("Error al guardar.", "err");
      setNv({ fecha:hoyISO(), monto:"", nota:"" }); mostrarAviso("Valorización registrada ✓");
    };
    const toggleCobro = async (v) => { await supabase.from("ingresos").update({ cobrada:!v.cobrada, fecha_cobro:!v.cobrada?hoyISO():null }).eq("id", v.id); };
    const agregarCC = async () => {
      const monto = parseFloat(na.monto); if (!monto||monto<=0) return mostrarAviso("Ingresa el monto.", "err");
      const { error } = await supabase.from("caja_chica").insert({ id:Date.now().toString(36), fecha:na.fecha, monto, nota:na.nota.trim() });
      if (error) return mostrarAviso("Error al guardar.", "err");
      setNa({ fecha:hoyISO(), monto:"", nota:"" }); mostrarAviso("Asignación registrada ✓");
    };
    const eliminarCC = async (a) => { if(!window.confirm(`¿Eliminar asignación de ${fmt(a.monto)}?`))return; await supabase.from("caja_chica").delete().eq("id", a.id); };

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ background:C.negro, borderRadius:12, padding:"18px 16px", color:C.crema }}>
          <div style={{ fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:C.doradoClaro, fontWeight:700 }}>Capital de trabajo estimado · {nombreMes(mesActual)}</div>
          <div style={{ fontSize:26, fontWeight:800, margin:"8px 0 4px" }}>{fmt(capitalNecesario)}</div>
          <div style={{ fontSize:12.5, opacity:0.85, lineHeight:1.6 }}>Gastos del mes {fmt(gastoMesActual)} + planilla estimada {fmt(planillaEstimada)} − cobros pendientes RTX {fmt(cobroPendiente)}</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          <div style={cajaResumen}><div style={etqResumen}>Cobrado</div><div style={{ fontWeight:800, fontSize:14.5, color:C.ok }}>{fmt(ingresosCobrados)}</div></div>
          <div style={cajaResumen}><div style={etqResumen}>Por cobrar</div><div style={{ fontWeight:800, fontSize:14.5, color:C.alerta }}>{fmt(ingresosPorCobrar)}</div></div>
          <div style={cajaResumen}><div style={etqResumen}>Gastado</div><div style={{ fontWeight:800, fontSize:14.5 }}>{fmt(gastadoTotal)}</div></div>
        </div>
        <div style={{ background:C.blanco, border:`2px solid ${C.dorado}`, borderRadius:12, padding:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10 }}>
            <div style={tituloSeccion}>Caja chica</div>
            <div style={{ fontSize:17, fontWeight:800, color: ccSaldo<0?C.peligro:C.ok }}>Saldo: {fmt(ccSaldo)}</div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, color:C.gris, marginBottom:12 }}>
            <span>Asignado: <b style={{color:C.negro}}>{fmt(ccAsignado)}</b></span><span>Gastado: <b style={{color:C.negro}}>{fmt(ccGastado)}</b></span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div><Etiqueta>Fecha</Etiqueta><input type="date" value={na.fecha} onChange={(e)=>setNa({...na,fecha:e.target.value})} style={estiloInput}/></div>
            <div><Etiqueta>Monto (S/)</Etiqueta><input type="number" inputMode="decimal" placeholder="0.00" value={na.monto} onChange={(e)=>setNa({...na,monto:e.target.value})} style={estiloInput}/></div>
          </div>
          <input type="text" placeholder="Nota, ej: Reposición semana 3" value={na.nota} onChange={(e)=>setNa({...na,nota:e.target.value})} style={{...estiloInput,marginBottom:10}}/>
          <button onClick={agregarCC} style={{...estiloBoton(true),width:"100%",padding:"12px"}}>Registrar asignación del gerente</button>
          {cc.length>0 && <div style={{ marginTop:12 }}>{cc.map((a)=>(
            <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 2px", borderTop:`1px solid ${C.linea}`, fontSize:13.5 }}>
              <span>{fmtFecha(a.fecha)}{a.nota?` · ${a.nota}`:""}</span>
              <span style={{ display:"flex", gap:12, alignItems:"center" }}><b>{fmt(a.monto)}</b><button onClick={()=>eliminarCC(a)} style={btnLink(C.peligro)}>✕</button></span>
            </div>
          ))}</div>}
        </div>
        <div style={{ background:C.blanco, border:`1px solid ${C.linea}`, borderRadius:10, padding:14 }}>
          <div style={tituloSeccion}>Registrar valorización / EDP facturada a RTX</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div><Etiqueta>Fecha de factura</Etiqueta><input type="date" value={nv.fecha} onChange={(e)=>setNv({...nv,fecha:e.target.value})} style={estiloInput}/></div>
            <div><Etiqueta>Monto (con IGV)</Etiqueta><input type="number" inputMode="decimal" placeholder="0.00" value={nv.monto} onChange={(e)=>setNv({...nv,monto:e.target.value})} style={estiloInput}/></div>
          </div>
          <input type="text" placeholder="Nota, ej: EDP N° 02 junio" value={nv.nota} onChange={(e)=>setNv({...nv,nota:e.target.value})} style={{...estiloInput,marginBottom:10}}/>
          <button onClick={agregarIngreso} style={{...estiloBoton(true),width:"100%",padding:"12px"}}>Guardar valorización</button>
        </div>
        <div><div style={tituloSeccion}>Ingresos — Valorizaciones / EDP</div>
          {ingresos.length===0 && <div style={{ fontSize:13, color:C.gris }}>Sin valorizaciones registradas.</div>}
          {ingresos.map((v)=>(
            <div key={v.id} style={{ background:C.blanco, border:`1px solid ${C.linea}`, borderRadius:10, padding:"11px 13px", marginBottom:8 }}>
              <div><b style={{ fontSize:14.5 }}>{fmt(v.monto)}</b>{v.nota && <span style={{ fontSize:13, color:C.gris }}> · {v.nota}</span>}
                <div style={{ fontSize:12.5, color:C.gris, marginTop:2 }}>
                  {v.cobrada && v.fecha_cobro ? <>Facturada {fmtFecha(v.fecha)} → <b style={{color:C.ok}}>cobrada el {fmtFecha(v.fecha_cobro)}</b></> : <>Facturada {fmtFecha(v.fecha)} → cobro esperado <b style={{color:C.negro}}>{fmtFecha(sumaDias(v.fecha,7))}</b></>}
                </div>
              </div>
              <button onClick={()=>toggleCobro(v)} style={{ marginTop:8, padding:"6px 12px", borderRadius:20, border:`1.5px solid ${v.cobrada?C.ok:C.alerta}`, background:v.cobrada?"#EAF4EC":"#FFF6E5", color:v.cobrada?C.ok:"#7a4d10", fontSize:12.5, fontWeight:700, cursor:"pointer" }}>{v.cobrada?"✓ Cobrada":"Pendiente — marcar cobrada"}</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const tabs = [
    { id:"registrar", txt:"Registrar", icon:"＋" },
    { id:"gastos", txt:"Gastos", icon:"📋" },
    { id:"techos", txt:"Techos", icon:"📊" },
    { id:"caja", txt:"Caja", icon:"💰" },
  ];

  if (cargando) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.crema, fontFamily:"Arial,sans-serif", color:C.gris }}>Cargando datos del proyecto…</div>;

  return (
    <div style={{ minHeight:"100vh", background:"#FAF7EC", fontFamily:"'Segoe UI',Arial,sans-serif", color:C.negro }}>
      <header style={{ background:C.negro, padding:"14px 16px 12px", position:"sticky", top:0, zIndex:20, borderBottom:`3px solid ${C.dorado}` }}>
        <div style={{ maxWidth:640, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ color:C.doradoClaro, fontWeight:800, fontSize:15 }}>LEÓN PT · Control de Gastos</div>
            <div style={{ color:C.crema, fontSize:11.5, opacity:0.8 }}>Proyecto Mara — Contrato N° 10212 · RTX Perú</div></div>
          <div style={{ textAlign:"right" }}><div style={{ color:C.crema, fontSize:10, textTransform:"uppercase", opacity:0.7 }}>Ejecutado</div>
            <div style={{ color:C.doradoClaro, fontWeight:800, fontSize:15 }}>{fmt(gastadoTotal)}</div></div>
        </div>
      </header>
      {aviso && <div style={{ position:"fixed", top:70, left:"50%", transform:"translateX(-50%)", background:aviso.tipo==="err"?C.peligro:C.ok, color:"#fff", padding:"10px 18px", borderRadius:24, fontSize:14, fontWeight:600, zIndex:50, boxShadow:"0 4px 14px rgba(0,0,0,0.25)", maxWidth:"88%", textAlign:"center" }}>{aviso.txt}</div>}
      <main style={{ maxWidth:640, margin:"0 auto", padding:"16px 14px 96px" }}>
        {tab==="registrar" && <FormRegistro/>}
        {tab==="gastos" && <ListaGastos/>}
        {tab==="techos" && <VistaTechos/>}
        {tab==="caja" && <VistaCaja/>}
      </main>
      {fotoModal && <div onClick={()=>setFotoModal(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:60, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
        <img src={fotoModal} alt="voucher" style={{ maxWidth:"100%", maxHeight:"88vh", borderRadius:10 }}/></div>}
      <nav style={{ position:"fixed", bottom:0, left:0, right:0, background:C.negro, borderTop:`2px solid ${C.dorado}`, display:"flex", zIndex:30 }}>
        {tabs.map((t)=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, padding:"10px 4px 12px", background:"none", border:"none", cursor:"pointer", color: tab===t.id?C.doradoClaro:"#8d8672", fontWeight: tab===t.id?800:600, fontSize:12 }}>
            <div style={{ fontSize:18, marginBottom:2 }}>{t.icon}</div>{t.txt}
          </button>
        ))}
      </nav>
    </div>
  );
}
