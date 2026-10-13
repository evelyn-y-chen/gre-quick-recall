export type Rating = "unknown" | "fuzzy" | "familiar";
export type Ratings = Record<string,Rating>;
export const ratingModules = ["bb","words","equivalents","a-plus","glee","math","lclj","a-plus-words"] as const;
export function validRatings(value:unknown):value is Ratings {
 return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length <= 30000 && Object.entries(value).every(([k,v])=>k.length>0 && k.length<=200 && !["__proto__","constructor","prototype"].includes(k) && ["unknown","fuzzy","familiar"].includes(v as string));
}
export function reconcileRatings(local:Ratings,cloud:Ratings,pending:Ratings) {
 const changes:Ratings={...pending};
 for(const [key,value] of Object.entries(local)) if(!Object.hasOwn(cloud,key) && !Object.hasOwn(changes,key)) changes[key]=value;
 return {ratings:{...local,...cloud,...changes},pending:changes};
}
