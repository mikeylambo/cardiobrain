#!/usr/bin/env python3
"""
Build CardioBrain's Rhyme Rush word payload from Barsmith's pronunciation data.

    pip install english-words
    python3 scripts/build-rhyme-data.py ../barsmith/src/data/pronunciations.txt

Barsmith's payload (CMU Pronouncing Dictionary, compact one-char-per-phoneme encoding,
frequency bucket appended) is built for a writer and keeps rare words. A game played
mid-workout needs words a person recognises in under a second, so this keeps only:

  - frequency bucket >= 4 (Zipf >= 3.4), and
  - words Webster's Second lists in lowercase, which drops surnames, places, brands
    and acronyms (`bauer`, `edison`, `dnc`) that frequency alone lets through, and
  - not also a capitalised entry (a name) unless hand-checked, and
  - nothing on the blocklist below.

The encoding is unchanged, so src/modes/rhyme/engine.ts decodes it exactly as Barsmith
does. The CMU notice travels in src/data/PRONUNCIATION-LICENSE.
"""
import gzip
import os
import sys

from english_words import get_english_words_set

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "data", "rhyme-words.txt")
MIN_BUCKET = 4

# Words that are fine in a dictionary and wrong in a workout game.
BLOCK = set("""
abortion abuse addict anal anus arse ass bastard bitch bitches bloody blowjob boob boobs
bomb breast butt cancer chink clit cock coon corpse crap cum cunt damn death dick dildo
dyke fag faggot fart fuck fucker fucking gay genocide god goddamn gook hell homo horny
jizz kike kill killed killer killing lesbian massacre molest murder nazi negro nigger
nude orgasm penis piss poop porn prick pussy queer rape raped rapist retard scrotum semen
sex sexual sexy shit slut sperm spic suicide terror terrorist tit tits torture twat vagina
whore wank weed slave slavery cocaine heroin drunk pimp leukemia alcoholic tortured
hooker stripper overdose cancerous tumor
""".split())


# Webster's lists many words both as a name and as a common word (`bill`, `ross`,
# `toby`). Frequency cannot tell them apart, so any word Webster's also capitalises is
# dropped unless it is on this hand-checked list of words people use as words.
AMBIGUOUS_KEEP = set("""
academic ah allies ally alpine amen art as atlas attic axis ban bare bat bath bee beta
bill bride boxer brandy bud cape carry case cat chin chip chuck clay cliff cola colt
creek delicious delta demon derby dot drew duchess duke eastern empire fan federal fiber
fin foster fur gale gold grace grant gulf gum guy hazel heather herb holly jack jam
jersey job judge king kit kitty lance laurel lead list lord lot major male march mark
marsh mass mat may media median medic medieval mercury mister mole muse nanny net nice
no odds old olive pace page pan part pat peg penny pilot ping piper plastic pole polish
poll pop price ram ran ray real red rich riff robin rod rogue romance root rum rusty
salmon sandy sanity school scientist scripture sedan sergeant serpent shadow sham shape
shrine sigma sir skip snow son south space spike spring spy star state stern stone swat
tab tame tang tape think those trinity trio triumph trying tuna turbo turkey urban
valentine van vice vote wave wealthy will win wind wolf for the came rotary maritime
mosaic mosquito renaissance titanic warden modern
""".split())


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: build-rhyme-data.py <barsmith pronunciations.txt>")
    web2 = get_english_words_set(["web2"], lower=False)
    lower_words = {w for w in web2 if w.islower()}
    capitalised = {w.lower() for w in web2 if w[:1].isupper()}

    kept = []
    with open(sys.argv[1]) as fh:
        for line in fh:
            line = line.rstrip("\n")
            if not line:
                continue
            word, enc = line.split(" ", 1)
            bucket = int(enc[-1])
            if bucket < MIN_BUCKET or len(word) < 2:
                continue
            if word not in lower_words or word in BLOCK:
                continue
            if word in capitalised and word not in AMBIGUOUS_KEEP:
                continue
            kept.append(line)

    payload = "\n".join(kept)
    with open(OUT, "w") as fh:
        fh.write(payload)
    gz = len(gzip.compress(payload.encode(), 9))
    print(f"wrote {OUT}: {len(kept):,} words, {len(payload)/1024:.0f} KB raw, {gz/1024:.0f} KB gzipped")


if __name__ == "__main__":
    main()
