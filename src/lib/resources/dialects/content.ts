export type VocabRow = {
  english: string;
  majhi: string;
  dialect: string;
};

export type ComparisonRow = {
  label: string;
  majhi: string;
  dialect: string;
};

export type DialectContent = {
  slug: string;
  name: string;
  cardDescription: string;
  isAnchor?: boolean;
  whereSpoken: string;
  whyMatters?: string;
  whyKiddaTeaches?: string[];
  sentenceStructure?: {
    prose?: string[];
    comparisonTable?: ComparisonRow[];
  };
  phoneticSubstitutions?: string;
  tone?: string;
  vocabulary?: VocabRow[];
  framingNote?: string;
};

export const DIALECTS_INTRO = [
  "Punjabi has several regional dialects.",
  "Kidda teaches Majhi — the standard form used in our lessons.",
  "This section shows how other dialects differ, and why Majhi was chosen as the foundation.",
];

export const DIALECTS: DialectContent[] = [
  {
    slug: "majhi",
    name: "Majhi",
    cardDescription: "The dialect you're already learning — and why Kidda teaches it",
    isAnchor: true,
    whereSpoken:
      "Majha region — Amritsar, Tarn Taran, Gurdaspur districts in Indian Punjab, and Lahore, Gujranwala, Faisalabad, Sialkot and surrounding areas in Pakistani Punjab.",
    whyKiddaTeaches: [
      "Majhi isn't \"more correct\" Punjabi — it's the most central Punjabi, and that centrality is exactly why it works as a teaching standard. The Majha region sits geographically between every other major dialect: Doaba to the northeast, Malwa to the south, the western dialects (Pothohari and others) to the west. This isn't just geography — linguists measure it directly: Majhi shows 74-95% lexical similarity with neighbouring dialects in every direction, the highest mutual-intelligibility score of any single Punjabi variety. Learn Majhi and you're not learning \"one dialect among many\" — you're learning the dialect every other dialect can be most easily understood against.",
      "This is also why Majhi became the written standard on both sides of the border. The Gurmukhi literary tradition (including Sikh scripture) and the Shahmukhi standard in Pakistan both formalised around Majha-region speech, so it's simultaneously the most geographically central AND the most institutionally standard form — media, schoolbooks, news broadcasts, and formal writing in both India and Pakistan default to it.",
      "Think of Majhi as the dialect that unlocks every door. Once you know it, a Doabi speaker's vocabulary swaps, a Malwai speaker's tense construction, or a Puadhi speaker's possessive markers will read as variations on something you already know, not a different language.",
    ],
  },
  {
    slug: "doabi",
    name: "Doabi",
    cardDescription: "Punjab's diaspora hub — between the Beas and Sutlej rivers",
    whereSpoken:
      "Jalandhar, Hoshiarpur, Kapurthala, Nawanshahr districts, between the Beas and Sutlej rivers. Also found in Faisalabad, Pakistan, due to post-1947 migration of Muslim Doabi speakers from East Punjab.",
    whyMatters:
      "Doaba is called Punjab's \"NRI hub\" because a disproportionately large share of Punjabi emigration to the UK and Canada traces back to this specific region — particularly the Greater Vancouver area and Brampton, Ontario in Canada. If your own family's Punjabi roots are from the diaspora rather than directly from Majha, there's a meaningfully good chance Doabi (not Majhi) is the dialect your grandparents actually grew up speaking at home, even though Kidda teaches you Majhi as the foundation.",
    sentenceStructure: {
      prose: [
        "Doabi uses distinct auxiliary verb constructions in some tenses compared to Majhi, though the precise patterns are less thoroughly documented than some other dialects.",
      ],
    },
    vocabulary: [
      { english: "between", majhi: "ਵਿੱਚਕਾਰ (vichkar)", dialect: "ਗੱਭੇ (gabbe)" },
    ],
    tone:
      "Doabi is generally described as a comparatively soft and lower-pitched dialect compared to Majhi or Malwai, and is noted for incorporating more English/Hindi loanwords in everyday speech — likely a reflection of its historically high rates of overseas migration.",
  },
  {
    slug: "malwai",
    name: "Malwai",
    cardDescription: "The dialect behind most Punjabi pop culture",
    whereSpoken:
      "South of the Sutlej river — the largest dialect region by area, covering more than half of Punjab's districts: Ludhiana, Bathinda, Patiala, Sangrur, Moga, Mansa, Barnala, Muktsar, Faridkot, Ferozepur, Fazilka, plus parts of northern Haryana and Rajasthan. Roughly 10 million speakers — the largest single dialect population in Punjabi.",
    whyMatters:
      "Malwai is the dialect of contemporary Punjabi pop culture — most mainstream Punjabi music and film uses Malwai, making it arguably the dialect most familiar to a global audience through media exposure, even among people who've never been to Punjab.",
    sentenceStructure: {
      comparisonTable: [
        {
          label: "I am coming",
          majhi: "ਮੈਂ ਆ ਰਿਹਾ ਹਾਂ (mai aa reha haa)",
          dialect: "ਮੈਂ ਆਈ ਜਾਨਾਂ (mai aayi jaanaan)",
        },
        {
          label: "He is coming",
          majhi: "ਉਹ ਆ ਰਿਹਾ ਹੈ (oh aa reha hai)",
          dialect: "ਉਹ ਆਈ ਜਾਂਦੈ (oh aayi jaandai)",
        },
        {
          label: "He will come",
          majhi: "ਉਹ ਆਵੇਗਾ (oh aavega)",
          dialect: "ਉਹ ਆਊਗਾ (oh aaooga)",
        },
      ],
      prose: [
        "Malwai's continuous tense is built differently from Majhi's — rather than the root + ਰਿਹਾ/ਰਹੀ + auxiliary pattern Kidda teaches, Malwai uses a construction closer to \"[verb] + ਜਾਨਾਂ/ਜਾਂਦੈ.\" The future tense ending is also shortened compared to Majhi's -ਾਵੇਗਾ.",
      ],
    },
    phoneticSubstitutions:
      "ਵ (v) sometimes becomes ਬ (b) or ਮ (m) — e.g. ਵੀਰ (veer, \"brother\") can become ਬੀਰ (beer) in Malwai speech. ਸ਼ (sh) and ਚ (ch) sounds also interchange in some words.",
    vocabulary: [
      { english: "to lift / pick up", majhi: "ਚੁੱਕਣਾ (chukkna)", dialect: "ਚੱਕਣਾ (chakkna)" },
      { english: "to uproot / dig out", majhi: "ਪੁੱਟਣਾ (puttna)", dialect: "ਪੱਟਣਾ (pattna)" },
      { english: "your", majhi: "ਤੁਹਾਡਾ (tuhaada)", dialect: "ਥੋਡਾ / ਸੋਡਾ (thoda / soda)" },
      {
        english: "boy",
        majhi: "ਮੁੰਡਾ (munda)",
        dialect: "ਝੱਟਾ (jhatta) — informal/regional",
      },
    ],
  },
  {
    slug: "puadhi",
    name: "Puadhi",
    cardDescription: "Distinct possessive markers on the Chandigarh border",
    whereSpoken:
      "Puadh region — Kharar, Ropar, Morinda, Rajpura, extending into Haryana, Chandigarh, and Himachal Pradesh border areas.",
    sentenceStructure: {
      prose: [
        "Puadhi has a genuine grammatical difference in possessive case markers — it uses ਕਾ/ਕੀ/ਕੇ/ਕੀਆਂ (kā/kī/ke/kīān) where Majhi uses ਦਾ/ਦੀ/ਦੇ/ਦੀਆਂ (dā/dī/de/dīān). This marker is shared with neighbouring Haryanvi varieties and isn't found in most other Punjabi dialects. The ablative \"from\" is also different: ਤੇ (te) in Puadhi vs Majhi's ਤੋਂ (ton).",
      ],
    },
    vocabulary: [
      { english: "now", majhi: "ਹੁਣ (hun)", dialect: "ਈਬ (īb)" },
      { english: "our / ours", majhi: "ਸਾਡਾ (saada)", dialect: "ਮ੍ਹਾਰਾ (mhaara)" },
      { english: "your / yours", majhi: "ਤੁਹਾਡਾ (tuhaada)", dialect: "ਥਾਰਾ (thaara)" },
      { english: "this", majhi: "ਇਹ (eh)", dialect: "ਯੋ (yo)" },
      { english: "boy", majhi: "ਮੁੰਡਾ (munda)", dialect: "ਛੋਕਰਾ (chokra)" },
      { english: "with", majhi: "ਨਾਲ (naal)", dialect: "ਗੈਲ (gail)" },
    ],
  },
  {
    slug: "pothohari",
    name: "Pothohari",
    cardDescription: "Western Punjab and the UK diaspora",
    whereSpoken:
      "Pothohar Plateau, Rawalpindi division (Pakistan), extending into Azad Kashmir border areas.",
    framingNote:
      "Pothohari (also called Pahari-Pothwari) is increasingly classified by linguists as its own language cluster within the broader Lahnda group, rather than simply \"a Punjabi dialect\" in the same sense as Doabi or Malwai. It has over 2.5 million speakers in Pakistan and Azad Kashmir plus a further 500,000+ in the UK, where it's the second most common mother tongue among British Pakistanis — meaning some Kidda learners with Pakistani-heritage family may have grown up around Pothohari specifically.",
    sentenceStructure: {
      prose: [
        "Pothohari forms the future tense with an -s suffix, rather than Majhi's -ਗਾ (gā) ending. This -s future is shared with several other western Punjabi varieties (Shahpuri, Jhangochi, Dhanni) and with Hindko and Saraiki, making it a marker of the wider western dialect family rather than something unique to Pothohari alone.",
      ],
    },
  },
];

export const DIALECT_BY_SLUG = Object.fromEntries(
  DIALECTS.map((dialect) => [dialect.slug, dialect])
) as Record<string, DialectContent>;

export const DIALECTS_HUB_HREF = "/dashboard/resources/dialects";

export function getOtherDialects(anchorSlug: string): DialectContent[] {
  return DIALECTS.filter((dialect) => dialect.slug !== anchorSlug);
}
