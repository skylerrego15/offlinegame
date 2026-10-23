// WebGL effect layer for the high-end hatch reveals. Renders a full-screen fragment
// shader into an offscreen canvas that the 2D renderer composites. Falls back silently.
let gl = null, cv = null, ok = false, quad = null, tex = null;
const progs = {};

const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

const COMMON = `
precision highp float;
uniform vec2 uRes; uniform vec2 uC; uniform float uT, uK, uH, uF, uFx;
uniform vec3 uCol, uCol2; uniform sampler2D uBg;
float h1(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
vec2 h2(vec2 p){ float n=h1(p); return vec2(n, h1(p+n+17.17)); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h1(i),h1(i+vec2(1.,0.)),u.x), mix(h1(i+vec2(0.,1.)),h1(i+vec2(1.,1.)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<5;i++){ v+=a*noise(p); p=m*p; a*=.5; } return v; }
vec2 P(){ return (gl_FragCoord.xy-uC)/uRes.y; }
vec2 UV(){ return gl_FragCoord.xy/uRes; }
vec2 p2uv(vec2 p){ return (p*uRes.y+uC)/uRes; }
vec3 bg(vec2 uv){ return texture2D(uBg, clamp(uv, .001, .999)).rgb; }
float HH(){ return min(uH, 1.); }
// hatch pulse: sharp flash that settles to a gentle glow
float HP(){ return uH>0. ? exp(-uH*2.4)*(1.-exp(-uH*30.))*1.6+.18 : 0.; }
`;

const FX = {
  // ---- combo hit: emission-only layer (composited additively over the dive)
  combo: `void main(){ vec2 p=P(); float age=uK; float L=uH; float t=uT;
    float r=length(p); float a=atan(p.y,p.x);
    vec3 col=vec3(0.);
    float core=exp(-r*r*1100.)*exp(-age*9.)*1.6+exp(-r*16.)*exp(-age*5.5)*.35;
    col+=mix(uCol,vec3(1.),.6)*core;
    float sk=min(L,10.);
    float streak=exp(-abs(p.y)*(150.-sk*7.))*exp(-abs(p.x)*(3.6-sk*.18))*exp(-age*4.2)*(.28+sk*.035);
    col+=mix(vec3(.6,.85,1.),uCol,.45)*streak;
    for(int i=0;i<3;i++){ float fi=float(i);
      if(fi>floor(sk/4.)) break;
      float ag=age-fi*.085;
      if(ag<0.) continue;
      float R=(1.-exp(-ag*5.))*(.2+sk*.022+fi*.06);
      float n=(noise(vec2(a*6.+fi*3.,t*2.))-.5)*.02*(1.+fi);
      float d=r-R+n;
      float w=.005+ag*.022;
      float ring=exp(-d*d/(w*w))*exp(-ag*3.4);
      col+=mix(vec3(1.),uCol,.35+fi*.2)*ring*(.85-fi*.22);
      col+=uCol*smoothstep(R,R*.55,r)*exp(-ag*5.)*.05;
    }
    float fil=pow(noise(vec2(a*9.,r*14.-age*10.)),7.)*exp(-r*6.)*smoothstep(3.,5.,sk)*exp(-age*3.)*3.;
    col+=mix(uCol,vec3(1.,.95,.9),.3)*fil;
    vec2 uv=UV(); float edge=pow(max(abs(uv.x-.5),abs(uv.y-.5))*2.,4.);
    col+=uCol*edge*smoothstep(5.,9.,sk)*exp(-age*2.5)*.22;
    gl_FragColor=vec4(col,1.); }`,

  // ---- deep water volume: haze, light shafts, drifting particulate
  deep: `void main(){ vec2 p=P(); vec2 uv=UV(); float t=uT;
    vec3 col=bg(uv)*.12*vec3(.6,.8,1.)+mix(vec3(0.,.005,.012),vec3(0.,.04,.07),uv.y);
    float hz=fbm(p*1.3+vec2(t*.02,-t*.03));
    col+=vec3(.0,.06,.09)*hz*.6;
    float shafts=pow(noise(vec2(uv.x*7.+uv.y*1.8, t*.15)),4.)*smoothstep(.2,1.,uv.y);
    col+=vec3(.25,.5,.6)*shafts*.35;
    vec2 g=floor(gl_FragCoord.xy*.35+vec2(0.,t*6.)); float sp=step(.995,h1(g));
    col+=vec3(.5,.6,.65)*sp*.25;
    col+=uCol*exp(-length(p)*6.)*(.25+uK*.9+HP()*2.);
    gl_FragColor=vec4(col,1.); }`,

  // ---- billowing ink in water that parts on hatch
  blacktide: `void main(){ vec2 p=P(); vec2 uv=UV(); float t=uT;
    vec3 base=bg(uv)*.26+vec3(0.,.01,.02);
    vec2 w=vec2(fbm(p*2.2+vec2(0.,t*.12)), fbm(p*2.2+vec2(5.2,-t*.1)));
    float d=fbm(p*2.6+w*1.8+vec2(0.,t*.05));
    float r=length(p);
    float R=mix(.03,1.35,1.-pow(1.-uK,2.));
    float m=smoothstep(R,R-.35,r+(d-.5)*.7);
    float ink=m*smoothstep(.22,.62,d+.18);
    float hh=uH*1.7;
    float hole=step(.0001,uH)*smoothstep(hh,hh-.45,r+(d-.5)*.55);
    ink*=1.-hole;
    float edge=m*(1.-m)*4.;
    vec3 inkc=mix(vec3(.008,.01,.018), uCol*.22, smoothstep(.5,.95,d)*edge);
    inkc+=vec3(.05,.07,.1)*pow(d,3.)*.6;
    float glow=exp(-r*5.)*(.35+uK*1.3+HP()*2.2);
    float a=atan(p.y,p.x);
    float rays=pow(noise(vec2(a*12.,t*.5)),4.)*hole*exp(-r*1.2)*2.2;
    vec3 col=mix(base, inkc, clamp(ink*.96,0.,1.));
    col+=uCol*glow*(1.-ink*.88)+mix(uCol,vec3(1.),.5)*rays;
    gl_FragColor=vec4(col,1.); }`,

  // ---- storm clouds lit from within by lightning (bolts drawn on top in 2D)
  thunder: `void main(){ vec2 p=P(); vec2 uv=UV(); float t=uT;
    vec3 base=bg(uv)*.16;
    vec2 q=vec2(p.x*1.1,p.y*2.)+vec2(t*.05,0.);
    vec2 w=vec2(fbm(q*1.4+t*.04), fbm(q*1.4+3.1-t*.03));
    float c=fbm(q*1.7+w*1.5);
    float cover=smoothstep(.15,.95,uv.y);
    float dens=smoothstep(.3,.85,c)*(.35+.65*cover)*smoothstep(0.,.25,uK+.05);
    vec2 d2=(uv-vec2(uFx,.92))*vec2(uRes.x/uRes.y,1.);
    float fl=uF*exp(-length(d2)*2.);
    vec3 cloud=vec3(.035,.04,.06)*dens+vec3(.72,.8,1.)*dens*(fl*2.+c*uF*.35);
    vec3 col=base*(1.-dens*.85)+cloud;
    float rn=noise(vec2(p.x*95.,p.y*3.+t*30.));
    col+=vec3(.55,.62,.75)*smoothstep(.94,1.,rn)*.1*uK;
    col+=vec3(.7,.8,1.)*uF*.1;
    col+=uCol*exp(-length(p)*6.)*(.3+uK*.8+HP()*2.);
    gl_FragColor=vec4(col,1.); }`,

  // ---- sunlit caustics dancing across the scene
  caustic: `void main(){ vec2 p=P(); vec2 uv=UV(); float t=uT*.55+11.;
    vec3 base=bg(uv)*.3*vec3(.65,.9,1.)+vec3(0.,.03,.06);
    vec2 pp=mod(uv*vec2(uRes.x/uRes.y,1.)*6.28318*1.25, 6.28318)-250.;
    vec2 i=pp; float c=1.; float inten=.005;
    for(int n=0;n<5;n++){ float tt=t*(1.-(3.5/float(n+1)));
      i=pp+vec2(cos(tt-i.x)+sin(tt+i.y), sin(tt-i.y)+cos(tt+i.x));
      c+=1./length(vec2(pp.x/(sin(i.x+tt)/inten), pp.y/(cos(i.y+tt)/inten))); }
    c/=5.; c=1.17-pow(c,1.4); float caus=pow(abs(c),8.);
    float rays=pow(noise(vec2(uv.x*9.+uv.y*2.5, t*.3)),3.)*smoothstep(.05,1.,uv.y);
    float k=.2+uK*.95+HH()*.8;
    vec3 col=base+vec3(.55,.95,1.)*caus*.5*k+vec3(.5,.9,.95)*rays*.4*k;
    col+=mix(uCol,vec3(.6,1.,1.),.4)*exp(-length(p)*5.)*(.3+uK*1.2+HP()*2.);
    gl_FragColor=vec4(col,1.); }`,

  // ---- black smoker: rising superheated plume, heat shimmer, vent glow
  vent: `void main(){ vec2 p=P(); vec2 uv=UV(); float t=uT;
    vec2 dist=(vec2(noise(p*14.+t*2.5),noise(p*14.-t*2.5+4.))-.5)*.014*(uK+HH());
    vec3 base=bg(uv+dist)*.2*vec3(1.,.72,.62);
    float y=p.y+.6;
    float wdt=.07+max(y,0.)*.42;
    vec2 q=vec2(p.x/wdt*.6, y*2.1-t*1.15);
    float s=fbm(q*1.25+vec2(fbm(q*.8+t*.2)*1.3,0.));
    float mask=exp(-p.x*p.x/(wdt*wdt)*1.3)*smoothstep(-.05,.15,y)*smoothstep(0.,.35,uK+.04);
    float smoke=smoothstep(.28,.8,s)*mask;
    float heat=exp(-max(y,0.)*2.4);
    vec3 sm=mix(vec3(.035,.03,.03), vec3(1.,.36,.07)*1.5, heat*smoothstep(.42,.92,s));
    sm+=vec3(.12,.05,.03)*smoothstep(.6,.9,s)*(1.-heat);
    vec3 col=mix(base, sm, clamp(smoke*1.15,0.,1.));
    col+=vec3(1.,.42,.08)*exp(-length(p-vec2(0.,-.6))*4.5)*(.35+uK*1.1)*1.3;
    col+=uCol*exp(-length(p)*6.)*(.25+uK*.8+HP()*2.);
    gl_FragColor=vec4(col,1.); }`,

  // ---- dark plankton water (particles drawn in 2D)
  biolum: `void main(){ vec2 p=P(); vec2 uv=UV();
    vec3 col=bg(uv)*.16+vec3(0.,.012,.03);
    float h=fbm(p*1.5+vec2(uT*.03,0.));
    col+=vec3(0.,.1,.13)*h*.35;
    col+=mix(uCol,vec3(.3,1.,.9),.5)*exp(-length(p)*4.)*(.15+uK*.7+HP()*2.);
    gl_FragColor=vec4(col,1.); }`,

  // ---- black hole: gravitational lensing, accretion disk, photon ring
  horizon: `void main(){ vec2 p=P(); float t=uT;
    float fo=1.-smoothstep(0.,.35,uH);
    float rs=max(.004, mix(0.,.09,smoothstep(0.,.55,uK))*fo);
    float r=length(p);
    vec2 dir=p/max(r,1e-4);
    float defl=rs*rs*2.2/max(r,rs*.9+1e-4);
    vec2 lp=p-dir*defl;
    vec3 col=bg(p2uv(lp))*.3;
    vec2 sg=floor(lp*70.); vec2 sf=fract(lp*70.)-.5-(h2(sg)-.5)*.6;
    float st=step(.93,h1(sg))*smoothstep(.09,0.,length(sf))*(.4+.6*h1(sg+3.1));
    col+=vec3(.85,.9,1.)*st*1.3;
    vec2 q=vec2(p.x,p.y*3.4);
    float dr=length(q), ang=atan(q.y,q.x);
    float pl=fbm(vec2(ang*2.6-t*2.4+.25/max(dr,.01), dr*16.));
    float disk=smoothstep(rs*1.45,rs*2.1,dr)*smoothstep(rs*6.5,rs*2.6,dr);
    float dop=1.+.75*cos(ang+.3);
    vec3 dc=mix(vec3(1.,.42,.12),vec3(1.,.96,.88),pl)*mix(vec3(1.),uCol*1.6,.35);
    float front=min(1.,step(0.,-p.y)+step(rs*1.08,r));
    col+=dc*disk*pl*dop*2.4*front*fo;
    float arc=exp(-pow((r-rs*1.8)/(rs*.2+1e-4),2.))*smoothstep(-.2*rs,.35*rs,p.y);
    col+=dc*arc*1.3*pl*fo;
    col+=(vec3(1.,.9,.78)*exp(-pow((r-rs*1.5)/(rs*.03+1e-4),2.))*.9+vec3(1.,.85,.7)*exp(-pow((r-rs*1.5)/(rs*.12+1e-4),2.))*.25)*fo;
    col*=mix(1., smoothstep(rs*.96,rs*1.04,r), fo);
    col+=mix(uCol,vec3(1.),.5)*exp(-r*7.)*HP()*3.;
    gl_FragColor=vec4(col,1.); }`,

  // ---- a vast wet eye opening in the dark
  gaze: `void main(){ vec2 p=P(); float t=uT;
    vec3 col=bg(UV())*.06;
    float o=smoothstep(.06,.5,uK);
    float W=.46;
    float ex=p.x/W;
    float sk=fbm(p*9.)*.6+fbm(p*28.)*.4;
    vec3 skin=vec3(.075,.062,.07)*(.45+sk*1.1);
    float dd=length(vec2(ex,p.y/.26));
    float wr=smoothstep(0.,.3,abs(fract(dd*7.+fbm(p*5.)*1.4)-.5));
    skin*=.62+.38*wr;
    skin+=vec3(.05,.035,.04)*pow(fbm(p*16.+4.),3.)*1.5;
    col=mix(col,skin,smoothstep(1.35,.85,length(vec2(ex,p.y/.3))));
    float lidH=.2*o*max(0.,1.-ex*ex);
    float inEye=smoothstep(.003,-.003,abs(p.y)-lidH)*step(abs(ex),1.);
    vec2 look=vec2(sin(t*.8)*.055, cos(t*.55)*.015)*(1.-smoothstep(.5,.85,uK));
    vec2 ip=p-look; float ir=length(ip);
    float vein=smoothstep(.014,0.,abs(fbm(p*7.+3.)-.5))*smoothstep(.13,.4,ir);
    vec3 scl=mix(vec3(.8,.73,.58),vec3(.55,.06,.05),vein*.85);
    scl*=.35+.65*smoothstep(0.,.13,lidH-abs(p.y));
    float R0=.155;
    float a=atan(ip.y,ip.x);
    float fib=noise(vec2(a*30.,ir*20.))*.55+fbm(vec2(a*7.,ir*12.))*.45;
    vec3 irc=mix(uCol*1.25, vec3(1.,.82,.32), smoothstep(R0,.02,ir))*(.4+fib*.95);
    float limb=smoothstep(R0-.035,R0,ir);
    irc=mix(irc,vec3(.015),limb*.85);
    float pw=mix(.05,.011,smoothstep(0.,.7,uK))+smoothstep(.78,1.,uK)*.3;
    float pupil=smoothstep(1.03,.97,length(vec2(ip.x/pw, ip.y/(R0*.93))));
    vec3 ec=mix(scl, irc, smoothstep(R0+.004,R0-.004,ir));
    ec=mix(ec, vec3(0.), pupil);
    ec+=vec3(1.)*smoothstep(.028,0.,length(p-vec2(-.065,.075)))*.95;
    ec+=vec3(.8,.9,1.)*smoothstep(.13,0.,length((p-vec2(.05,-.07))*vec2(1.,2.2)))*.07;
    col=mix(col, ec, inEye);
    col*=1.-smoothstep(.022,0.,abs(abs(p.y)-lidH))*step(abs(ex),1.)*.55*o;
    col+=uCol*exp(-length(p)*5.)*HP()*1.1;
    gl_FragColor=vec4(col,1.); }`,

  // ---- deep-sea aurora curtains
  aurora: `void main(){ vec2 p=P(); vec2 uv=UV(); float t=uT;
    vec3 col=bg(uv)*.14+vec3(0.,.008,.028);
    vec3 acc=vec3(0.);
    for(int i=0;i<4;i++){ float fi=float(i);
      float y0=.1+fi*.085+.07*sin(p.x*2.3+t*.35+fi*1.7)+(fbm(vec2(p.x*1.4+fi*3.,t*.08))-.5)*.32;
      float d=p.y-y0;
      float edge=exp(-pow(d/.025,2.));
      float fade=exp(-max(d,0.)*5.5)*smoothstep(-.01,.0,d);
      float streak=.35+.65*pow(noise(vec2(p.x*55.+fi*7.,t*.35)),1.4);
      vec3 c=mix(vec3(.15,1.,.55), uCol*1.3, fi/3.);
      c=mix(c, vec3(.85,.3,1.), smoothstep(.02,.32,d));
      acc+=c*(edge*1.1+fade*.55)*streak;
    }
    col+=acc*(.12+uK*1.05+HP()*1.4);
    col+=uCol*exp(-length(p)*5.)*(.25+uK*.9+HP()*2.);
    gl_FragColor=vec4(col,1.); }`,

  // ---- reality fractures into glass and falls away into the void
  shatter: `
    vec3 voidc(vec2 p){ float t=uT;
      float n=fbm(p*1.7+vec2(fbm(p*2.2+t*.05),fbm(p*2.2-t*.04)));
      vec3 c=mix(vec3(.01,0.,.03), uCol*.7, pow(n,2.2));
      c+=mix(vec3(.5,.2,1.),vec3(.2,.9,1.),n)*pow(n,5.)*1.5;
      vec2 sg=floor(p*80.); vec2 sf=fract(p*80.)-.5-(h2(sg)-.5)*.6;
      c+=vec3(1.)*step(.94,h1(sg))*smoothstep(.1,0.,length(sf))*h1(sg+5.);
      return c; }
    void main(){ vec2 p=P(); float t=uT;
      float S=5.6;
      float ft=uH*1.5;
      vec3 col=voidc(p);
      bool hit=false;
      for(int j=-2;j<=2;j++){ for(int i=-2;i<=2;i++){
        if(hit) continue;
        vec2 cell=floor(p*S)+vec2(float(i),float(j));
        vec2 sd=(cell+h2(cell))/S;
        vec2 dir=normalize(sd+vec2(.0001))+(h2(cell+7.)-.5)*.7;
        float tt=max(ft-length(sd)*.35,0.);
        vec2 off=dir*tt*.32+vec2(0.,-1.)*tt*tt*1.1;
        float sc=1.-min(tt*.22,.55);
        vec2 q=(p-sd-off)/sc+sd;
        vec2 gq=q*S; vec2 fq=floor(gq); float md=9.; float md2=9.; vec2 mc=vec2(0.);
        for(int b=-1;b<=1;b++){ for(int a=-1;a<=1;a++){
          vec2 c=fq+vec2(float(a),float(b)); vec2 s=c+h2(c); float d=length(gq-s);
          if(d<md){ md2=md; md=d; mc=c; } else if(d<md2){ md2=d; } } }
        if(mc==cell && tt<3.){
          hit=true;
          float e=md2-md;
          vec2 ofs=(h2(cell+3.)-.5)*.012*uK;
          vec3 sc3=vec3(bg(p2uv(q+ofs+vec2(.002,0.))).r, bg(p2uv(q+ofs)).g, bg(p2uv(q+ofs-vec2(.002,0.))).b);
          sc3*=.55-.15*uK;
          vec2 nrm=(h2(cell+9.)-.5);
          float spec=pow(max(0.,dot(normalize(vec3(nrm*.9,1.)),normalize(vec3(-.4,.5,1.)))),30.);
          sc3+=vec3(.9,.95,1.)*spec*(.15+.4*step(.0001,uH));
          float crR=uK*1.25;
          float crack=smoothstep(.022,0.,e+(noise(q*60.)-.5)*.01)*smoothstep(crR,crR-.08,length(sd));
          sc3+=(vec3(1.)*.9+uCol*.5)*crack*(1.-step(.0001,uH)*.5);
          sc3+=vec3(.8,.9,1.)*smoothstep(.02,0.,e)*step(.0001,uH)*.5;
          col=sc3;
        }
      } }
      col+=uCol*exp(-length(p)*6.)*(uK*.6+HP()*2.5);
      gl_FragColor=vec4(col,1.); }`,
};

function compile(name) {
  const fs = COMMON + FX[name];
  const mk = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error('shader ' + name, gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const v = mk(gl.VERTEX_SHADER, VS), f = mk(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return (progs[name] = null);
  const p = gl.createProgram();
  gl.attachShader(p, v); gl.attachShader(p, f);
  gl.bindAttribLocation(p, 0, 'a');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error('link ' + name, gl.getProgramInfoLog(p)); return (progs[name] = null); }
  const u = {};
  for (const n of ['uRes', 'uC', 'uT', 'uK', 'uH', 'uF', 'uFx', 'uCol', 'uCol2', 'uBg']) u[n] = gl.getUniformLocation(p, n);
  return (progs[name] = { p, u });
}

export function initGL() {
  try {
    cv = document.createElement('canvas');
    cv.width = 4; cv.height = 4;
    gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) return false;
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([6, 10, 18]));
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ok = false; });
    ok = true;
    // compile in the background so the first reveal doesn't hitch
    const names = Object.keys(FX);
    let i = 0;
    const step = () => { if (!ok || i >= names.length) return; if (!(names[i] in progs)) compile(names[i]); i++; setTimeout(step, 30); };
    setTimeout(step, 400);
    return true;
  } catch (e) {
    ok = false;
    return false;
  }
}

export function glOk() { return ok && gl && !gl.isContextLost(); }

// capture what's on screen right now as the backdrop the shaders refract/darken
export function snapshot(src) {
  if (!glOk()) return;
  try {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
  } catch (e) {}
}

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

// u: { W, H, cx, cy, t, k, h, col, col2, flash, flashX }  scale: resolution factor
export function renderFX(name, u, scale = 0.6) {
  if (!glOk()) return null;
  const pr = progs[name] === undefined ? compile(name) : progs[name];
  if (!pr) return null;
  const w = Math.max(16, Math.round(u.W * scale)), h = Math.max(16, Math.round(u.H * scale));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  gl.viewport(0, 0, w, h);
  gl.useProgram(pr.p);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const U = pr.u;
  gl.uniform2f(U.uRes, w, h);
  gl.uniform2f(U.uC, u.cx * scale, (u.H - u.cy) * scale);
  gl.uniform1f(U.uT, u.t);
  gl.uniform1f(U.uK, u.k);
  gl.uniform1f(U.uH, u.h);
  gl.uniform1f(U.uF, u.flash || 0);
  gl.uniform1f(U.uFx, u.flashX ?? 0.5);
  gl.uniform3fv(U.uCol, hex(u.col));
  gl.uniform3fv(U.uCol2, hex(u.col2 || u.col));
  gl.uniform1i(U.uBg, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return cv;
}
