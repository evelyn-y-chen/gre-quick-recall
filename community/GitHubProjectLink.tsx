import './githubProjectLink.css';
export const GITHUB_PROJECT_URL='https://github.com/evelyn-y-chen/gre-quick-recall';
export default function GitHubProjectLink({english=false,onClick}:{english?:boolean;onClick?:()=>void}){
 return <a className="githubProjectLink" href={GITHUB_PROJECT_URL} target="_blank" rel="noopener noreferrer" onClick={onClick}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-4.3 1.3-4.3-2.3-6-2.8M15 22v-3.4c0-1 .1-1.7-.5-2.4 3.3-.4 6.7-1.6 6.7-7.2 0-1.6-.6-2.9-1.6-3.9.2-.4.7-1.9-.2-3.8 0 0-1.3-.4-4.1 1.5a14 14 0 0 0-7.4 0C5.1.9 3.8 1.3 3.8 1.3c-.9 1.9-.4 3.4-.2 3.8C2.6 6.1 2 7.4 2 9c0 5.6 3.4 6.8 6.7 7.2-.5.5-.7 1.2-.7 2.2V22"/></svg><span>{english?'View project on GitHub':'GitHub 项目'}</span><span aria-hidden="true">↗</span></a>;
}
