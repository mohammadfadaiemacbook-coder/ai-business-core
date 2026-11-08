#!/usr/bin/env node
import { createServer } from "node:http";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat, lstat, realpath } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash, timingSafeEqual } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { homedir } from "node:os";
import { dirname, join, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const here=dirname(fileURLToPath(import.meta.url));
try {
  const env=await readFile(join(here,".env"),"utf8");
  for(const line of env.split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m&&process.env[m[1]]===undefined)process.env[m[1]]=m[2].replace(/^[\"']|[\"']$/g,"");}
} catch {}
const TOKEN=String(process.env.AIBC_RENDERER_TOKEN||"");
const PORT=Math.max(1024,Math.min(65535,Number(process.env.AIBC_MEDIA_PORT||8788)));
const configuredRoot=String(process.env.AIBC_MEDIA_DIR||"").replace(/^~(?=\/)/,homedir());
const ROOT=resolve(configuredRoot||join(homedir(),"Library","Application Support","AI Business Core","media"));
await mkdir(ROOT,{recursive:true});
const STORAGE_ROOT=await realpath(ROOT);
const MAX=64*1024*1024;
const MIME=new Set(["video/webm","video/mp4","video/quicktime"]);
if(TOKEN.length<32)throw new Error("AIBC_RENDERER_TOKEN must contain at least 32 characters.");
function authorized(req){const h=String(req.headers.authorization||"");const a=Buffer.from(h),b=Buffer.from("Bearer "+TOKEN);return a.length===b.length&&timingSafeEqual(a,b);}
function send(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(body));}
function target(parts){if(parts.length!==3)throw new Error("Invalid asset path");const [workspace,id,name]=parts;if(!/^[A-Za-z0-9_-]{3,64}$/.test(workspace)||!/^[a-f0-9-]{36}$/i.test(id)||!/^[A-Za-z0-9._-]{1,100}$/.test(name))throw new Error("Invalid asset identifier");const path=resolve(STORAGE_ROOT,workspace,id,name);if(!path.startsWith(STORAGE_ROOT+sep))throw new Error("Invalid storage path");return path;}
async function ensureSafeParent(finalPath){
  const relativeParent=relative(STORAGE_ROOT,dirname(finalPath));
  let current=STORAGE_ROOT;
  for(const part of relativeParent.split(sep).filter(Boolean)){
    current=join(current,part);
    try{
      const info=await lstat(current);
      if(info.isSymbolicLink()||!info.isDirectory())throw new Error("Unsafe media directory");
    }catch(error){
      if(error.code!=="ENOENT")throw error;
      try{await mkdir(current);}catch(createError){if(createError.code!=="EEXIST")throw createError;}
      const info=await lstat(current);
      if(info.isSymbolicLink()||!info.isDirectory())throw new Error("Unsafe media directory");
    }
  }
  const parent=await realpath(current);
  if(parent!==STORAGE_ROOT&&!parent.startsWith(STORAGE_ROOT+sep))throw new Error("Invalid storage path");
  return parent;
}
const server=createServer(async(req,res)=>{
  if(!authorized(req)){send(res,401,{error:"Unauthorized"});return;}
  const url=new URL(req.url||"/","http://127.0.0.1");
  if(url.pathname==="/health"&&req.method==="GET"){send(res,200,{ok:true,storage:"local",root:"configured"});return;}
  const match=url.pathname.match(/^\/assets\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if(!match){send(res,404,{error:"Not found"});return;}
  let finalPath;try{finalPath=target(match.slice(1).map(decodeURIComponent));}catch{send(res,400,{error:"Invalid asset path"});return;}
  if(req.method==="PUT"){
    const type=String(req.headers["content-type"]||"").toLowerCase();
    const length=Number(req.headers["content-length"]||0);
    if(!MIME.has(type)){send(res,415,{error:"Unsupported media type"});return;}
    if(length>MAX){send(res,413,{error:"File exceeds 64 MB"});return;}
    const temp=finalPath+"."+createHash("sha256").update(String(Date.now())+Math.random()).digest("hex").slice(0,12)+".part";
    try{
      await ensureSafeParent(finalPath);
      try{if((await lstat(finalPath)).isSymbolicLink())throw new Error("Symbolic links are not allowed");}catch(error){if(error.code!=="ENOENT")throw error;}
      let size=0;
      const limiter= new (await import("node:stream")).Transform({transform(chunk,enc,cb){size+=chunk.length;if(size>MAX){cb(new Error("File exceeds 64 MB"));return;}cb(null,chunk);}});
      await pipeline(req,limiter,createWriteStream(temp,{flags:"wx"}));
      if(!size)throw new Error("Empty file");
      await rename(temp,finalPath);
      send(res,201,{ok:true,size});
    }catch(error){await rm(temp,{force:true}).catch(()=>{});send(res,error.message.includes("64 MB")?413:400,{error:error.message.includes("64 MB")?"File exceeds 64 MB":"Upload failed"});}
    return;
  }
  if(req.method==="GET"){
    try{
      const parent=await realpath(dirname(finalPath));
      if(parent!==STORAGE_ROOT&&!parent.startsWith(STORAGE_ROOT+sep))throw new Error("Invalid storage path");
      const entry=await lstat(finalPath);
      if(entry.isSymbolicLink()||!entry.isFile())throw new Error("Invalid asset file");
      const safePath=await realpath(finalPath);
      if(!safePath.startsWith(STORAGE_ROOT+sep))throw new Error("Invalid storage path");
      const info=await stat(safePath);
      const requestedType=String(url.searchParams.get("type")||"");
      const contentType=MIME.has(requestedType)||requestedType==="application/octet-stream"?requestedType:"application/octet-stream";
      res.writeHead(200,{"content-type":contentType,"content-length":String(info.size),"cache-control":"private, no-store"});
      await pipeline(createReadStream(safePath),res);
    }catch{if(!res.headersSent)send(res,404,{error:"Asset not found"});else res.destroy();}
    return;
  }
  if(req.method==="DELETE"){
    try{
      const parent=await realpath(dirname(finalPath));
      if(parent!==STORAGE_ROOT&&!parent.startsWith(STORAGE_ROOT+sep))throw new Error("Invalid storage path");
      try{if((await lstat(finalPath)).isSymbolicLink())throw new Error("Symbolic links are not allowed");}catch(error){if(error.code!=="ENOENT")throw error;}
      await rm(finalPath,{force:true});
      send(res,200,{ok:true});
    }catch{send(res,400,{error:"Invalid asset path"});}
    return;
  }
  send(res,405,{error:"Method not allowed"});
});
server.listen(PORT,"127.0.0.1",()=>console.log("AI Business Core local media service listening on 127.0.0.1:"+PORT+"; storage="+ROOT));
