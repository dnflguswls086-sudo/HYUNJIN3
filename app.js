import {firebaseConfig,APP_CONFIG} from "./firebase-config.js";
import {initializeApp} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,collection,query,orderBy,limit,onSnapshot,serverTimestamp,deleteDoc,addDoc} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {getStorage,ref as sref,uploadBytes,getDownloadURL,deleteObject} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";
const $=id=>document.getElementById(id), app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),storage=getStorage(app);
let selected="",studentName="",posts=[],cur=null,photos=[],teacherMode=false,unsub=null,cunsub=null;
const views=["landing","login","board","teacher"];
function view(id){views.forEach(v=>$(v).classList.toggle("hidden",v!==id));scrollTo(0,0)}
function toast(s){$("toast").textContent=s;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),1800)}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
function kparts(){const ps=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()),o={};ps.forEach(p=>o[p.type]=p.value);return{date:`${o.year}-${o.month}-${o.day}`,hour:+o.hour}}
function openNow(){const k=kparts(),s=APP_CONFIG.openSchedule[k.date];return !!s&&k.hour>=s.start&&k.hour<s.end}
function openUI(){const o=openNow();$("closed").classList.toggle("hidden",o);if(!o)$("closed").textContent="현재는 학생 운영 시간이 아닙니다. 금요일 11:00~23:00, 토·일 09:00~20:00에 이용할 수 있어요.";updateGo();if(!o&&!$("board").classList.contains("hidden")&&!teacherMode){view("landing");toast("학생 운영시간이 종료되었어요.")}}
function updateGo(){const ok=$("agree1").dataset.ok==="1"&&$("agree1").checked&&$("agree2").checked&&openNow();$("goLogin").disabled=!ok}
$("rules").addEventListener("scroll",()=>{const e=$("rules");if(e.scrollTop+e.clientHeight>=e.scrollHeight-15){["agree1","agree2"].forEach(id=>{$(id).disabled=false;$(id).dataset.ok="1"});$("a1").classList.remove("disabled");$("a2").classList.remove("disabled");updateGo()}});
$("agree1").onchange=updateGo;$("agree2").onchange=updateGo;$("goLogin").onclick=()=>{view("login");renderNames();};$("backRules").onclick=()=>view("landing");

function renderNames(){
  document.querySelectorAll(".namebtn").forEach(b=>{
    b.onclick=()=>choose(b.dataset.n);
  });
}
function choose(n){
  selected=n;
  $("nameGrid").classList.add("hidden");
  $("authPanel").classList.remove("hidden");
  $("backRules").classList.add("hidden");
  $("modeChoice").classList.remove("hidden");
  $("passwordPanel").classList.add("hidden");
  $("authTitle").textContent=`${n}`;
  $("authMsg").textContent="";
  $("pw").value=""; $("pw2").value="";
}
function setAuthMode(mode){
  $("modeChoice").classList.add("hidden");
  $("passwordPanel").classList.remove("hidden");
  $("authMsg").textContent="";
  $("pw").value=""; $("pw2").value="";
  if(mode==="register"){
    $("authGuide").innerHTML="<b>처음 한 번만</b> 사용할 비밀번호를 직접 정해 주세요. 비밀번호는 6자 이상이어야 합니다.";
    $("pw2").classList.remove("hidden");
    $("authAction").textContent="내 계정 만들기";
    $("authAction").onclick=registerStudent;
  }else{
    $("authGuide").textContent="처음에 만든 비밀번호를 입력해 주세요.";
    $("pw2").classList.add("hidden");
    $("authAction").textContent="로그인";
    $("authAction").onclick=loginStudent;
  }
}
$("chooseRegister").onclick=()=>setAuthMode("register");
$("chooseLogin").onclick=()=>setAuthMode("login");
$("backMode").onclick=()=>{$("passwordPanel").classList.add("hidden");$("modeChoice").classList.remove("hidden");$("authMsg").textContent="";};
$("backNames").onclick=()=>{$("nameGrid").classList.remove("hidden");$("authPanel").classList.add("hidden");$("backRules").classList.remove("hidden")};

async function registerStudent(){
  if(!openNow())return toast("현재는 운영시간이 아니에요.");
  const p=$("pw").value,p2=$("pw2").value;if(p.length<6)return $("authMsg").textContent="비밀번호는 6자 이상으로 만들어 주세요.";if(p!==p2)return $("authMsg").textContent="비밀번호가 서로 달라요.";
  try{
    const accountRef=doc(db,"student_accounts",selected);
    const email=APP_CONFIG.studentEmails[selected],cred=await createUserWithEmailAndPassword(auth,email,p);
    try{
      await setDoc(accountRef,{name:selected,email,uid:cred.user.uid,createdAt:serverTimestamp()});
    }catch(err){
      await signOut(auth);
      throw err;
    }
    studentName=selected;toast("계정을 만들었어요!");enterBoard();
  }catch(e){console.error(e);$("authMsg").textContent=e.code==="auth/email-already-in-use"?"이미 이 이름으로 가입되어 있어요. ‘이미 비밀번호를 만들었어요 · 로그인’을 눌러 주세요.":"계정을 만들지 못했어요. 다시 확인해 주세요."}
}
async function loginStudent(){
  try{const cred=await signInWithEmailAndPassword(auth,APP_CONFIG.studentEmails[selected],$("pw").value);const a=await getDoc(doc(db,"student_accounts",selected));if(!a.exists()||a.data().uid!==cred.user.uid)throw new Error("profile mismatch");studentName=selected;enterBoard()}catch(e){console.error(e);$("authMsg").textContent="비밀번호가 맞지 않아요."}
}
function enterBoard(){if(!openNow())return view("landing");teacherMode=false;$("who").textContent=studentName;view("board");listenPosts()}
$("logout").onclick=async()=>{await signOut(auth);studentName="";view("landing")};

function listenPosts(){
  if(unsub)unsub();unsub=onSnapshot(query(collection(db,"posts"),orderBy("createdAt","desc"),limit(100)),s=>{posts=s.docs.map(d=>({id:d.id,...d.data()}));renderPosts();if(teacherMode)renderTeacherPosts()})
}
function renderPosts(){
  $("count").textContent=`${posts.length}개의 글`;
  $("posts").innerHTML=posts.length?posts.map(p=>`<div class="post" data-id="${p.id}"><div class="meta">${esc(p.authorName)} · ${p.imageUrls?.length?`📷 ${p.imageUrls.length}장`:""}</div><div class="ptitle">${esc(p.title)}</div><div>${esc(p.content).slice(0,120)}</div>${auth.currentUser?.uid===p.authorUid?`<div class="actions"><button class="mini danger del" data-id="${p.id}">삭제</button></div>`:""}</div>`).join(""):"아직 글이 없어요.";
  document.querySelectorAll("#posts .post").forEach(e=>e.onclick=ev=>{if(ev.target.closest("button"))return;openPost(e.dataset.id)});document.querySelectorAll(".del").forEach(b=>b.onclick=()=>delPost(b.dataset.id))
}
$("photos").onchange=()=>{photos=Array.from($("photos").files||[]).filter(f=>f.type.startsWith("image/")&&f.size<=APP_CONFIG.maxPhotoBytes).slice(0,3);$("previews").innerHTML=photos.map(f=>`<img src="${URL.createObjectURL(f)}">`).join("")};
$("submit").onclick=async()=>{
  if(!openNow())return toast("운영시간이 아니에요.");const title=$("title").value.trim(),content=$("content").value.trim();if(title.length<2||content.length<5)return toast("제목과 내용을 조금 더 써 주세요.");
  $("submit").disabled=true;let paths=[];try{const ref=doc(collection(db,"posts")),urls=[];for(let i=0;i<photos.length;i++){const f=photos[i],path=`post-images/${auth.currentUser.uid}/${ref.id}/${Date.now()}_${i}_${f.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;paths.push(path);$("uploadMsg").textContent=`사진 업로드 중 ${i+1}/${photos.length}`;const sr=sref(storage,path);await uploadBytes(sr,f,{contentType:f.type});urls.push(await getDownloadURL(sr))}
  await setDoc(ref,{title,content,authorName:studentName,authorUid:auth.currentUser.uid,imageUrls:urls,imagePaths:paths,createdAt:serverTimestamp()});$("title").value="";$("content").value="";$("photos").value="";photos=[];$("previews").innerHTML="";$("uploadMsg").textContent="";toast("게시했어요!")}
  catch(e){console.error(e);toast("게시하지 못했어요.")}finally{$("submit").disabled=false}
}
async function delPost(id){if(!confirm("이 글과 사진을 삭제할까요?"))return;const p=posts.find(x=>x.id===id);try{await deleteDoc(doc(db,"posts",id));for(const path of p.imagePaths||[]){try{await deleteObject(sref(storage,path))}catch{}}toast("삭제했어요.")}catch(e){console.error(e);toast("삭제하지 못했어요.")}}
async function openPost(id){cur=posts.find(x=>x.id===id);if(!cur)return;$("detail").innerHTML=`<div class="meta">${esc(cur.authorName)}</div><h2>${esc(cur.title)}</h2><div style="white-space:pre-wrap">${esc(cur.content)}</div>${(cur.imageUrls||[]).map(u=>`<img class="dimg" src="${esc(u)}">`).join("")}`;$("dlg").showModal();if(cunsub)cunsub();cunsub=onSnapshot(query(collection(db,"posts",id,"comments"),orderBy("createdAt","asc"),limit(100)),s=>{$("comments").innerHTML=s.docs.map(d=>{const c=d.data();return`<div class="commentbox"><div class="commenthead">${esc(c.authorName)}</div><div>${esc(c.content)}</div></div>`}).join("")});$("comment").classList.toggle("hidden",teacherMode);$("sendComment").classList.toggle("hidden",teacherMode)}
$("closeDlg").onclick=()=>$("dlg").close();$("sendComment").onclick=async()=>{const c=$("comment").value.trim();if(c.length<2)return;await addDoc(collection(db,"posts",cur.id,"comments"),{content:c,authorName:studentName,authorUid:auth.currentUser.uid,createdAt:serverTimestamp()});$("comment").value=""};

$("teacherBtn").onclick=()=>view("teacher");
$("tlogin").onclick=async()=>{try{const c=await signInWithEmailAndPassword(auth,$("te").value.trim(),$("tp").value);if(c.user.uid!==APP_CONFIG.teacherUid){await signOut(auth);throw 0}teacherMode=true;$("teacher").querySelector(".narrow").classList.add("hidden");$("tdash").classList.remove("hidden");await renderStatus();listenPosts()}catch(e){$("tmsg").textContent="교사용 로그인 정보를 확인해 주세요."}};
async function renderStatus(){let html="";for(const n of APP_CONFIG.students){const s=await getDoc(doc(db,"student_accounts",n));html+=`<div class="st ${s.exists()?"yes":""}">${n}<br><small>${s.exists()?"가입 완료":"미가입"}</small></div>`}$("status").innerHTML=html}
function renderTeacherPosts(){$("tposts").innerHTML=posts.map(p=>`<div class="post" data-id="${p.id}"><div class="meta">${esc(p.authorName)}</div><div class="ptitle">${esc(p.title)}</div><div>${esc(p.content).slice(0,120)}</div><button class="mini danger tdel" data-id="${p.id}">삭제</button></div>`).join("");document.querySelectorAll("#tposts .post").forEach(e=>e.onclick=ev=>{if(ev.target.closest("button"))return;openPost(e.dataset.id)});document.querySelectorAll(".tdel").forEach(b=>b.onclick=()=>delPost(b.dataset.id))}

$("teacherPostSubmit").onclick=async()=>{
  const title=$("teacherPostTitle").value.trim();
  const content=$("teacherPostContent").value.trim();
  $("teacherPostMsg").textContent="";
  if(!teacherMode || !auth.currentUser || auth.currentUser.uid!==APP_CONFIG.teacherUid){
    return $("teacherPostMsg").textContent="교사용 계정으로 로그인해 주세요.";
  }
  if(title.length<2 || content.length<2){
    return $("teacherPostMsg").textContent="제목과 내용을 입력해 주세요.";
  }
  $("teacherPostSubmit").disabled=true;
  try{
    await addDoc(collection(db,"posts"),{
      title:title.slice(0,50),
      content:content.slice(0,1500),
      authorName:"최현진 선생님",
      authorUid:auth.currentUser.uid,
      imageUrls:[],
      imagePaths:[],
      createdAt:serverTimestamp()
    });
    $("teacherPostTitle").value="";
    $("teacherPostContent").value="";
    $("teacherPostMsg").textContent="게시했습니다.";
    toast("선생님 글을 게시했어요!");
  }catch(e){
    console.error(e);
    $("teacherPostMsg").textContent="게시하지 못했습니다. Firestore 규칙을 확인해 주세요.";
  }finally{
    $("teacherPostSubmit").disabled=false;
  }
};

$("tout").onclick=async()=>{await signOut(auth);teacherMode=false;$("tdash").classList.add("hidden");$("teacher").querySelector(".narrow").classList.remove("hidden");view("landing")};
renderNames();openUI();setInterval(openUI,1000);onAuthStateChanged(auth,()=>{});
