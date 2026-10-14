export type LoginProvider='github'|'google';
export function enabledLoginProviders(settings:unknown):Record<LoginProvider,boolean>{
 const external=(settings&&typeof settings==='object'?'external' in settings?settings.external:null:null) as Record<string,unknown>|null;
 return {github:external?.github===true,google:external?.google===true};
}
export function socialLoginOptions(provider:LoginProvider,redirectTo:string){
 return {provider,options:{redirectTo,scopes:provider==='github'?'read:user user:email':'openid email profile'}};
}
