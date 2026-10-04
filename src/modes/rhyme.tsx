import { motion } from "framer-motion";
import type { Challenge, ModeDefinition } from "../engine/types";
import { pick, shuffle } from "../engine/rng";
import { targetResponseMs } from "../engine/difficulty";

/*
 * Rhyme Rush deliberately reuses the ideas in Barsmith's mature rhyme engine:
 * stressed-tail equality for perfect rhymes, vowel/coda similarity for slant,
 * and near-miss distractors. The full Barsmith CMU payload is much larger than
 * this mode needs, so v1 ships a curated common-word phonetic corpus inline.
 */

type Word = {
  word: string;
  tail: string;
  vowel: string;
  coda: string;
  family?: string;
};

const WORDS: Word[] = [
  {word:"FIRE",tail:"AY-R",vowel:"AY",coda:"R",family:"fire"},
  {word:"TIRE",tail:"AY-R",vowel:"AY",coda:"R",family:"fire"},
  {word:"WIRE",tail:"AY-R",vowel:"AY",coda:"R",family:"fire"},
  {word:"CHOIR",tail:"OY-R",vowel:"OY",coda:"R",family:"fire"},
  {word:"FIVE",tail:"AY-V",vowel:"AY",coda:"V",family:"fire-slant"},
  {word:"FINE",tail:"AY-N",vowel:"AY",coda:"N",family:"fire-slant"},
  {word:"FIGHT",tail:"AY-T",vowel:"AY",coda:"T",family:"fire-slant"},
  {word:"TREE",tail:"IY",vowel:"IY",coda:"",family:"not-fire"},

  {word:"RAIN",tail:"EY-N",vowel:"EY",coda:"N",family:"rain"},
  {word:"TRAIN",tail:"EY-N",vowel:"EY",coda:"N",family:"rain"},
  {word:"BRAIN",tail:"EY-N",vowel:"EY",coda:"N",family:"rain"},
  {word:"PLAIN",tail:"EY-N",vowel:"EY",coda:"N",family:"rain"},
  {word:"NAME",tail:"EY-M",vowel:"EY",coda:"M",family:"rain-slant"},
  {word:"FRAME",tail:"EY-M",vowel:"EY",coda:"M",family:"rain-slant"},
  {word:"STONE",tail:"OW-N",vowel:"OW",coda:"N",family:"not-rain"},

  {word:"NIGHT",tail:"AY-T",vowel:"AY",coda:"T",family:"night"},
  {word:"LIGHT",tail:"AY-T",vowel:"AY",coda:"T",family:"night"},
  {word:"MIGHT",tail:"AY-T",vowel:"AY",coda:"T",family:"night"},
  {word:"FLIGHT",tail:"AY-T",vowel:"AY",coda:"T",family:"night"},
  {word:"LIFE",tail:"AY-F",vowel:"AY",coda:"F",family:"night-slant"},
  {word:"TYPE",tail:"AY-P",vowel:"AY",coda:"P",family:"night-slant"},
  {word:"NOON",tail:"UW-N",vowel:"UW",coda:"N",family:"not-night"},

  {word:"MORE",tail:"AO-R",vowel:"AO",coda:"R",family:"ore"},
  {word:"CORE",tail:"AO-R",vowel:"AO",coda:"R",family:"ore"},
  {word:"DOOR",tail:"AO-R",vowel:"AO",coda:"R",family:"ore"},
  {word:"FLOOR",tail:"AO-R",vowel:"AO",coda:"R",family:"ore"},
  {word:"POUR",tail:"AO-R",vowel:"AO",coda:"R",family:"ore"},
  {word:"FORM",tail:"AO-R-M",vowel:"AO",coda:"RM",family:"ore-slant"},
  {word:"WORN",tail:"AO-R-N",vowel:"AO",coda:"RN",family:"ore-slant"},
  {word:"GREEN",tail:"IY-N",vowel:"IY",coda:"N",family:"not-ore"},

  {word:"DAY",tail:"EY",vowel:"EY",coda:"",family:"ay"},
  {word:"WAY",tail:"EY",vowel:"EY",coda:"",family:"ay"},
  {word:"STAY",tail:"EY",vowel:"EY",coda:"",family:"ay"},
  {word:"PLAY",tail:"EY",vowel:"EY",coda:"",family:"ay"},
  {word:"PHASE",tail:"EY-Z",vowel:"EY",coda:"Z",family:"ay-slant"},
  {word:"FACE",tail:"EY-S",vowel:"EY",coda:"S",family:"ay-slant"},
  {word:"BLUE",tail:"UW",vowel:"UW",coda:"",family:"not-ay"},

  {word:"DOWN",tail:"AW-N",vowel:"AW",coda:"N",family:"own"},
  {word:"CROWN",tail:"AW-N",vowel:"AW",coda:"N",family:"own"},
  {word:"TOWN",tail:"AW-N",vowel:"AW",coda:"N",family:"own"},
  {word:"FOUND",tail:"AW-N-D",vowel:"AW",coda:"ND",family:"own-slant"},
  {word:"SOUND",tail:"AW-N-D",vowel:"AW",coda:"ND",family:"own-slant"},
  {word:"BONE",tail:"OW-N",vowel:"OW",coda:"N",family:"not-own"},

  {word:"CARE",tail:"EH-R",vowel:"EH",coda:"R",family:"air"},
  {word:"SHARE",tail:"EH-R",vowel:"EH",coda:"R",family:"air"},
  {word:"BEAR",tail:"EH-R",vowel:"EH",coda:"R",family:"air"},
  {word:"CHAIR",tail:"EH-R",vowel:"EH",coda:"R",family:"air"},
  {word:"FAIR",tail:"EH-R",vowel:"EH",coda:"R",family:"air"},
  {word:"SPARE",tail:"EH-R",vowel:"EH",coda:"R",family:"air"},
  {word:"CAKE",tail:"EY-K",vowel:"EY",coda:"K",family:"not-air"},

  {word:"REALITY",tail:"AE-L-AX-T-IY",vowel:"IY",coda:"",family:"ality"},
  {word:"MENTALITY",tail:"AE-L-AX-T-IY",vowel:"IY",coda:"",family:"ality"},
  {word:"FATALITY",tail:"AE-L-AX-T-IY",vowel:"IY",coda:"",family:"ality"},
  {word:"FINALITY",tail:"AE-L-AX-T-IY",vowel:"IY",coda:"",family:"ality"},
  {word:"DUALITY",tail:"UW-AX-L-AX-T-IY",vowel:"IY",coda:"",family:"ality"},
  {word:"GRAVITY",tail:"AE-V-AX-T-IY",vowel:"IY",coda:"",family:"ality-slant"},
  {word:"TRAGEDY",tail:"AH-JH-AX-D-IY",vowel:"IY",coda:"D",family:"not-ality"}
];

const families = ["fire","rain","night","ore","ay","own","air","ality"] as const;
const byTail=(tail:string)=>WORDS.filter(w=>w.tail===tail);
const byFamily=(family:string)=>WORDS.filter(w=>w.family===family);
const byVowel=(vowel:string)=>WORDS.filter(w=>w.vowel===vowel);

function phoneSimilarity(a:string,b:string){
  if(a===b)return 1;
  const groups=[["M","N","NG"],["P","B"],["T","D"],["K","G"],["F","V"],["S","Z"],["R","L"],["N","M"]];
  for(const group of groups) if(group.includes(a)&&group.includes(b))return 0.65;
  return 0;
}

function codaSimilarity(a:string,b:string){
  if(a===b)return 1;
  if(!a||!b)return 0.2;
  const n=Math.min(a.length,b.length);
  let total=0,weights=0;
  for(let i=1;i<=n;i++){const w=1/i;total+=phoneSimilarity(a[a.length-i]!,b[b.length-i]!)*w;weights+=w;}
  return (total/weights)*(n/Math.max(a.length,b.length));
}

function slantScore(a:Word,b:Word){
  const vowel=a.vowel===b.vowel?1:0;
  const coda=codaSimilarity(a.coda,b.coda);
  return vowel*0.65+coda*0.35;
}

const exactFor=(word:Word)=>shuffle(byTail(word.tail).filter(x=>x.word!==word.word),mulberry32FromWord(word.word));
function mulberry32FromWord(word:string){let t=2166136261;for(const ch of word)t=Math.imul(t^ch.charCodeAt(0),16777619);let n=t>>>0;return()=>{n+=0x6D2B79F5;let r=Math.imul(n^(n>>>15),1|n);r^=r+Math.imul(r^(r>>>7),61|r);return((r^(r>>>14))>>>0)/4294967296;};}

function perfectChallenge(level:number,rng:()=>number,ctx:Parameters<ModeDefinition["generate"]>[2]):Challenge{
  const family=pick(families,rng);const pool=byFamily(family).filter(w=>w.tail===byFamily(family)[0]?.tail);
  const query=pick(pool,rng);
  const answer=pick(pool.filter(w=>w.word!==query.word),rng);
  const distractorFamilies=families.filter(f=>f!==family);
  const distractors=shuffle(
    distractorFamilies.flatMap(f=>byFamily(f)),
    rng
  ).filter(w=>w.word!==query.word&&w.word!==answer.word).slice(0,2);
  return makeChallenge("perfect",level,query.word,[answer,...distractors],answer.word,ctx);
}

function slantChallenge(level:number,rng:()=>number,ctx:Parameters<ModeDefinition["generate"]>[2]):Challenge{
  const query=pick(WORDS,rng);const candidates=byVowel(query.vowel).filter(w=>w.word!==query.word);
  const scored=candidates.map(w=>({w,score:slantScore(query,w)})).sort((a,b)=>b.score-a.score);
  const answer=scored.find(x=>x.score>=0.65&&x.w.tail!==query.tail)?.w??scored[scored.length>1?1:0]?.w??query;
  const nonMatches=shuffle(WORDS.filter(w=>w.word!==query.word&&w.word!==answer.word&&w.vowel!==query.vowel&&w.tail!==query.tail),rng);
  const options=shuffle([answer,...nonMatches.slice(0,3)],rng);
  return makeChallenge("slant",level,query.word,options,answer.word,ctx);
}

function chainChallenge(level:number,rng:()=>number,ctx:Parameters<ModeDefinition["generate"]>[2]):Challenge{
  const family=pick(["ality","air","night","rain"] as const,rng);
  const pool=byFamily(family).filter(w=>w.tail===byFamily(family)[0]?.tail);
  const chain=pool.length>=3?pool.slice(0,3):pool;
  const prompt=chain.length>=3?chain[0]!.word+" → "+chain[1]!.word+" → ?":chain[0]!.word+" → ?";
  const answer=chain.length>=3?chain[2]!:pool[0]!;
  const distractors=shuffle(WORDS.filter(w=>w.word!==answer.word&&w.family!==family),rng).slice(0,3);
  return makeChallenge("chain",level,prompt,[answer,...distractors],answer.word,ctx);
}

function oddOneChallenge(level:number,rng:()=>number,ctx:Parameters<ModeDefinition["generate"]>[2]):Challenge{
  const family=pick(families,rng);const pool=byFamily(family);
  const groupTail=pool[0]?.tail??family;
  const members=pool.filter(w=>w.tail===groupTail);
  const three=shuffle(members,rng).slice(0,3);
  const odd=pick(WORDS.filter(w=>w.family!==family&&w.tail!==groupTail),rng);
  return makeChallenge("odd",level,"WHICH ONE BREAKS THE PATTERN?",[...three,odd],odd.word,ctx);
}

function makeChallenge(type:"perfect"|"slant"|"chain"|"odd",level:number,prompt:string,words:Word[],answer:string,ctx:Parameters<ModeDefinition["generate"]>[2]):Challenge{
  const labels=type==="perfect"?"PERFECT":type==="slant"?"SLANT":type==="chain"?"CHAIN":"ODD ONE OUT";
  const seedRng=mulberry32FromWord(prompt+ctx.trialIndex);
  const unique:Word[]=[];
  const seen=new Set<string>();
  for(const word of [...words,...shuffle(WORDS,seedRng)]){
    if(seen.has(word.word))continue;
    seen.add(word.word);
    unique.push(word);
    if(unique.length===4)break;
  }
  return {
    id:`rhyme-${type}-${level}-${ctx.trialIndex}`,
    mode:"rhyme",
    kind:"rhyme",
    level,
    prompt,
    options:shuffle(unique.map((w)=>({id:w.word,label:w.word})),mulberry32FromWord("options:"+prompt+ctx.trialIndex)),
    correctAnswer:answer,
    targetRt:targetResponseMs("rhyme",level,ctx.activity,ctx.bias),
    data:{type,label:labels}
  };
}

export const rhymeMode:ModeDefinition={
  id:"rhyme",
  group:"words",
  label:"Rhyme Rush",
  shortLabel:"RHYME",
  description:"Keep the sound alive. Perfect, slant, chain, or spot the break.",
  generate:(level,rng,ctx)=>{
    if(level<=5)return perfectChallenge(level,rng,ctx);
    if(level<=10)return slantChallenge(level,rng,ctx);
    if(level<=15)return chainChallenge(level,rng,ctx);
    return oddOneChallenge(level,rng,ctx);
  },
  View:({challenge,onAnswer})=>{
    const data=challenge.data as {label:string};
    return <div className="mode-view rhyme-mode">
      <div className="rule-banner">{data.label}</div>
      <motion.div key={challenge.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="rhyme-prompt display-face">{challenge.prompt}</motion.div>
      <div className="answer-grid answer-grid-4">{challenge.options.map(option=>
        <motion.button key={option.id} className="answer-pad compact" whileTap={{scale:.96}} onClick={()=>onAnswer(option.id)} aria-label={option.label}>{option.label}</motion.button>
      )}</div>
    </div>;
  }
};
