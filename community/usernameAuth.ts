export type UsernameAction='login'|'register'|'recover'|'link'|'rotate';
export type AccountTokens={access_token:string;refresh_token:string};
export type UsernameResult={session:AccountTokens;username:string;recoveryCode?:string};

export class AccountMessage extends Error {}
export function canonicalUsername(value:string){return value.normalize('NFKC').trim().toLowerCase();}
export function validUsername(value:string){return /^[\p{L}\p{N}_-]{3,24}$/u.test(canonicalUsername(value));}
export function validAccountPassword(value:string){const bytes=new TextEncoder().encode(value).length;return bytes>=10&&bytes<=72;}
export function validateUsernameForm(username:string,password:string,confirmation:string,action:UsernameAction,recoveryCode:string){
 if(!validUsername(username))throw new AccountMessage('用户名需为 3–24 个字母、汉字、数字、下划线或连字符。');
 if(action==='rotate'){if(!password)throw new AccountMessage('请输入当前密码。');return;}
 if(!validAccountPassword(password))throw new AccountMessage('密码需为 10–72 个 UTF-8 字节；建议使用至少 10 位英文字母、数字或符号。');
 if(action!=='login'&&password!==confirmation)throw new AccountMessage('两次输入的密码不一致，请重新核对。');
 if(action==='recover'&&!recoveryCode.trim())throw new AccountMessage('请输入创建账号或上次找回时保存的恢复码。');
}
const failure='登录服务暂时不可用，请稍后重试。';
function structuredMessage(value:unknown,secrets:readonly string[],status?:number){
 if(!value||typeof value!=='object')return status===429?'操作太频繁，请稍后再试。':failure;
 const detail=value as {error?:unknown;code?:unknown;status?:unknown};
 if(status===429||detail.status===429||detail.code==='rate_limited')return '操作太频繁，请稍后再试。';
 const message=detail.error;
 if(typeof message==='string'&&message.trim()&&message.length<=300
  &&!secrets.some(secret=>secret&&message.includes(secret)))return message;
 return failure;
}
/** FunctionsHttpError stores non-2xx JSON in context; never display its raw exception. */
export async function readUsernameResult(result:{data:unknown;error:unknown},action:UsernameAction,secrets:readonly string[]=[]):Promise<UsernameResult>{
 if(result.error){
  const context=(result.error as {context?:Response})?.context;
  let detail=result.data;
  if(context&&typeof context.json==='function'){try{detail=await (typeof context.clone==='function'?context.clone():context).json();}catch{}}
  throw new AccountMessage(structuredMessage(detail,secrets,context?.status));
 }
 const value=result.data as Partial<UsernameResult>&{error?:unknown};
 if(value?.error)throw new AccountMessage(structuredMessage(value,secrets));
 if(!value||typeof value.username!=='string'||!validUsername(value.username)
  ||!value.session||typeof value.session.access_token!=='string'||!value.session.access_token
  ||typeof value.session.refresh_token!=='string'||!value.session.refresh_token
  ||(action!=='login'&&(typeof value.recoveryCode!=='string'||!value.recoveryCode.trim())))
  throw new AccountMessage('登录服务返回的信息不完整，请稍后重试；请保留已有账号信息。');
 return {username:value.username,session:{access_token:value.session.access_token,refresh_token:value.session.refresh_token},...(action==='login'?{}:{recoveryCode:value.recoveryCode!})};
}
export function accountFailureMessage(error:unknown){
 if(error instanceof AccountMessage)return error.message;
 const detail=error&&typeof error==='object'?error as {code?:unknown;status?:unknown}:{};
 if(detail.status===429||detail.code==='over_request_rate_limit')return '操作太频繁，请稍后再试。';
 if(detail.code==='invalid_credentials')return '邮箱或密码不正确，请核对后重试。';
 if(detail.code==='email_not_confirmed')return '该邮箱尚未验证，请使用原来的其他登录方式。';
 if(detail.code==='provider_disabled'||detail.code==='email_provider_disabled')return '此登录方式暂未开放，请选择其他可用方式。';
 if(error instanceof TypeError)return '暂时无法连接登录服务，请检查网络后重试。';
 return failure;
}
export function recoveryNote(username:string,code:string){
 return `Inkling 账号恢复码\n\n用户名：${username}\n恢复码：${code}\n\n请保存到只有你能访问的位置，不要公开或发送给他人。\n忘记密码时，在 Inkling 登录页选择“使用恢复码找回账号”。成功找回后会产生新的恢复码，旧恢复码随即失效。\n本文件不包含密码或登录令牌。\n`;
}

/** Decode only to detect local account-switch races; this never authorizes requests. */
export function tokenSubject(token:string):string|null{
 try{const payload=token.split('.')[1];if(!payload)return null;const decoded=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(payload.length/4)*4,'=')));return typeof decoded.sub==='string'&&decoded.sub?decoded.sub:null;}catch{return null;}
}
