/**
 * "Pick the ending" question bank. Please keep this checked against the course tables.
 *
 * Each line: [level, Beginner week or 0, English, Gurmukhi, romanised].
 * [set:n] is a gap: the options come from ENDING_SETS and n is the right one.
 * [] in the romanised line shows where each gap's romanised ending goes.
 */
export const ENDING_SETS: Record<string, [string, string][]> = {
  da: [["ਦਾ", "da"], ["ਦੀ", "di"], ["ਦੇ", "de"], ["ਦੀਆਂ", "diaa"]],
  nda: [["ਂਦਾ", "nda"], ["ਂਦੀ", "ndi"], ["ਂਦੇ", "nde"], ["ਂਦੀਆਂ", "ndiaa"]],
  tippi: [["ੰਦਾ", "nda"], ["ੰਦੀ", "ndi"], ["ੰਦੇ", "nde"], ["ੰਦੀਆਂ", "ndiaa"]],
  unda: [["ਉਂਦਾ", "unda"], ["ਉਂਦੀ", "undi"], ["ਉਂਦੇ", "unde"], ["ਉਂਦੀਆਂ", "undiaa"]],
  riha: [["ਿਹਾ", "iha"], ["ਹੀ", "ahi"], ["ਹੇ", "ahe"], ["ਹੀਆਂ", "ahiaa"]],
  adj: [["ਾ", "a"], ["ੀ", "i"], ["ੇ", "e"], ["ੀਆਂ", "iaa"]],
  nav: [["ਾਂ", "a"], ["ੀਂ", "i"], ["ੇਂ", "e"], ["ੀਆਂ", "iaa"]],
  ia: [["ਿਆ", "ia"], ["ੀ", "i"], ["ੇ", "e"], ["ੀਆਂ", "iaa"]],
  gaya: [["ਿਆ", "aya"], ["ਈ", "ayi"], ["ਏ", "aye"], ["ਈਆਂ", "ayiaa"]],
  aaya: [["ਇਆ", "ya"], ["ਈ", "yi"], ["ਏ", "ye"], ["ਈਆਂ", "yiaa"]],
  futC: [["ਾਂਗਾ", "aanga"], ["ਾਂਗੀ", "aangi"], ["ਾਂਗੇ", "aange"], ["ੇਗਾ", "ega"]],
  futC2: [["ੇਗਾ", "ega"], ["ੇਗੀ", "egi"], ["ੋਗੇ", "oge"], ["ਨਗੇ", "ange"]],
  futC3: [["ਨਗੇ", "ange"], ["ਨਗੀਆਂ", "angiaa"], ["ੋਗੇ", "oge"], ["ਾਂਗੇ", "aange"]],
  futV: [["ਵਾਂਗਾ", "vaanga"], ["ਵਾਂਗੀ", "vaangi"], ["ਵਾਂਗੇ", "vaange"], ["ਵੇਗਾ", "vega"]],
  futV2: [["ਵੇਗਾ", "vega"], ["ਵੇਗੀ", "vegi"], ["ਵੋਗੇ", "voge"], ["ਣਗੇ", "nge"]],
  futV3: [["ਣਗੇ", "nge"], ["ਣਗੀਆਂ", "ngiaa"], ["ਵੋਗੇ", "voge"], ["ਵਾਂਗੇ", "vaange"]],
  futAa: [["ਵਣਗੇ", "vange"], ["ਵਣਗੀਆਂ", "vangiaa"], ["ਵੋਗੇ", "voge"], ["ਵਾਂਗੇ", "vaange"]],
  pia: [["ਿਆ", "ia"], ["ਈ", "ai"], ["ਏ", "ae"], ["ਈਆਂ", "aiaa"]],
  verbalN: [["ਨਾ", "na"], ["ਦਾ", "da"], ["ਿਆ", "ia"], ["ੇਗਾ", "ega"]],
  verbalL: [["ਣਾ", "na"], ["ਦਾ", "da"], ["ਿਆ", "ia"], ["ੇਗਾ", "ega"]],
  impC: [["ੋ", "o"], ["ਾ", "a"], ["ੇ", "e"], ["ੀ", "i"]],
  impV: [["ਓ", "o"], ["ਈ", "i"], ["ਏ", "e"], ["ਵਾਂ", "vaa"]],
  subjC: [["ਾਂ", "aa"], ["ੇ", "e"], ["ੀਏ", "iye"], ["ੋ", "o"]],
  subjC2: [["ਣ", "an"], ["ੇ", "e"], ["ੀਏ", "iye"], ["ੋ", "o"]],
  subjV: [["ਵਾਂ", "vaa"], ["ਵੇ", "ve"], ["ਈਏ", "iye"], ["ਵੋ", "vo"]],
  obl: [["ਿਆਂ", "iaa"], ["ੇ", "e"], ["ਾ", "a"], ["ੀ", "i"]],
  oblF: [["ੀਆਂ", "iaa"], ["ੀ", "i"], ["ਾ", "a"], ["ੇ", "e"]],
  plural: [["ੇ", "e"], ["ਾ", "a"], ["ੀ", "i"], ["ੀਆਂ", "iaa"]],
  pluralF: [["ਾਂ", "aa"], ["ੀ", "i"], ["ੇ", "e"], ["ਾ", "a"]],
  iaan: [["ੀਆਂ", "iaa"], ["ੀ", "i"], ["ਾ", "a"], ["ੇ", "e"]],
  vala: [["ਾ", "a"], ["ੀ", "i"], ["ੇ", "e"], ["ੀਆਂ", "iaa"]],
};

export type EndingLine = [level: number, week: number, english: string, gurmukhi: string, romanised: string];

export const ENDING_LINES: EndingLine[] = [
  // Level 1, Week 2: present tense endings on consonant verbs
  [1, 2, "I work. (man speaking)", "ਮੈਂ ਕੰਮ ਕਰ[da:0] ਹਾਂ", "Mai kamm kar[] haa"],
  [1, 2, "I work. (woman speaking)", "ਮੈਂ ਕੰਮ ਕਰ[da:1] ਹਾਂ", "Mai kamm kar[] haa"],
  [1, 2, "I play. (man speaking)", "ਮੈਂ ਖੇਡ[da:0] ਹਾਂ", "Mai khed[] haa"],
  [1, 2, "I play. (woman speaking)", "ਮੈਂ ਖੇਡ[da:1] ਹਾਂ", "Mai khed[] haa"],
  [1, 2, "He plays.", "ਉਹ ਖੇਡ[da:0] ਹੈ", "Oh khed[] hai"],
  [1, 2, "She plays.", "ਉਹ ਖੇਡ[da:1] ਹੈ", "Oh khed[] hai"],
  [1, 2, "They play. (boys)", "ਉਹ ਖੇਡ[da:2] ਹਨ", "Oh khed[] han"],
  [1, 2, "They play. (girls)", "ਉਹ ਖੇਡ[da:3] ਹਨ", "Oh khed[] han"],
  [1, 2, "We learn. (mixed group)", "ਅਸੀਂ ਸਿੱਖ[da:2] ਹਾਂ", "Asi sikh[] haa"],
  [1, 2, "You speak Punjabi. (respectful)", "ਤੁਸੀਂ ਪੰਜਾਬੀ ਬੋਲ[da:2] ਹੋ", "Tusi Punjabi bol[] ho"],
  [1, 2, "He reads a book.", "ਉਹ ਕਿਤਾਬ ਪੜ੍ਹ[da:0] ਹੈ", "Oh kitaab parh[] hai"],
  [1, 2, "She writes a letter.", "ਉਹ ਚਿੱਠੀ ਲਿਖ[da:1] ਹੈ", "Oh chitthi likh[] hai"],
  [1, 2, "The girls listen.", "ਕੁੜੀਆਂ ਸੁਣ[da:3] ਹਨ", "Kurhiaa sun[] han"],
  [1, 2, "The boys run.", "ਮੁੰਡੇ ਦੌੜ[da:2] ਹਨ", "Munde daurh[] han"],
  [1, 2, "My sister reads and writes.", "ਮੇਰੀ ਭੈਣ ਪੜ੍ਹ[da:1] ਤੇ ਲਿਖ[da:1] ਹੈ", "Meri bhain parh[] te likh[] hai"],
  [1, 2, "My brother reads and writes.", "ਮੇਰਾ ਭਰਾ ਪੜ੍ਹ[da:0] ਤੇ ਲਿਖ[da:0] ਹੈ", "Mera bhra parh[] te likh[] hai"],
  [1, 2, "We speak and listen. (mixed group)", "ਅਸੀਂ ਬੋਲ[da:2] ਤੇ ਸੁਣ[da:2] ਹਾਂ", "Asi bol[] te sun[] haa"],
  // Level 1, Week 3: verb root types, irregulars, continuous
  [1, 3, "I drink water. (man speaking)", "ਮੈਂ ਪਾਣੀ ਪੀ[nda:0] ਹਾਂ", "Mai paani pee[] haa"],
  [1, 3, "I drink tea. (woman speaking)", "ਮੈਂ ਚਾਹ ਪੀ[nda:1] ਹਾਂ", "Mai chaah pee[] haa"],
  [1, 3, "She eats roti.", "ਉਹ ਰੋਟੀ ਖਾ[nda:1] ਹੈ", "Oh roti khaa[] hai"],
  [1, 3, "He eats roti.", "ਉਹ ਰੋਟੀ ਖਾ[nda:0] ਹੈ", "Oh roti khaa[] hai"],
  [1, 3, "We go to school. (mixed group)", "ਅਸੀਂ ਸਕੂਲ ਜਾ[nda:2] ਹਾਂ", "Asi school jaa[] haa"],
  [1, 3, "The girls go home.", "ਕੁੜੀਆਂ ਘਰ ਜਾ[nda:3] ਹਨ", "Kurhiaa ghar jaa[] han"],
  [1, 3, "He washes the clothes.", "ਉਹ ਕੱਪੜੇ ਧੋ[nda:0] ਹੈ", "Oh kaprhe dho[] hai"],
  [1, 3, "She takes the bag.", "ਉਹ ਬੈਗ ਲੈ[nda:1] ਹੈ", "Oh bag lai[] hai"],
  [1, 3, "She sings a song.", "ਉਹ ਗੀਤ ਗਾ[unda:1] ਹੈ", "Oh geet gaa[] hai"],
  [1, 3, "He makes food.", "ਉਹ ਖਾਣਾ ਬਣਾ[unda:0] ਹੈ", "Oh khaana banaa[] hai"],
  [1, 3, "My mum makes food.", "ਮੇਰੀ ਮਾਂ ਖਾਣਾ ਬਣਾ[unda:1] ਹੈ", "Meri maa khaana banaa[] hai"],
  [1, 3, "They come here. (boys)", "ਉਹ ਇੱਥੇ ਆ[unda:2] ਹਨ", "Oh ithe aa[] han"],
  [1, 3, "They come here. (girls)", "ਉਹ ਇੱਥੇ ਆ[unda:3] ਹਨ", "Oh ithe aa[] han"],
  [1, 3, "I live in London. (man speaking)", "ਮੈਂ ਲੰਡਨ ਵਿੱਚ ਰਹਿ[tippi:0] ਹਾਂ", "Mai London vich reh[] haa"],
  [1, 3, "I live in London. (woman speaking)", "ਮੈਂ ਲੰਡਨ ਵਿੱਚ ਰਹਿ[tippi:1] ਹਾਂ", "Mai London vich reh[] haa"],
  [1, 3, "She says this.", "ਉਹ ਇਹ ਕਹਿ[tippi:1] ਹੈ", "Oh eh keh[] hai"],
  [1, 3, "We give money.", "ਅਸੀਂ ਪੈਸੇ ਦਿ[tippi:2] ਹਾਂ", "Asi paise di[] haa"],
  [1, 3, "I am reading. (man speaking)", "ਮੈਂ ਪੜ੍ਹ ਰ[riha:0] ਹਾਂ", "Mai parh r[] haa"],
  [1, 3, "I am reading. (woman speaking)", "ਮੈਂ ਪੜ੍ਹ ਰ[riha:1] ਹਾਂ", "Mai parh r[] haa"],
  [1, 3, "He is eating.", "ਉਹ ਖਾ ਰ[riha:0] ਹੈ", "Oh khaa r[] hai"],
  [1, 3, "She is going.", "ਉਹ ਜਾ ਰ[riha:1] ਹੈ", "Oh jaa r[] hai"],
  [1, 3, "We are learning. (mixed group)", "ਅਸੀਂ ਸਿੱਖ ਰ[riha:2] ਹਾਂ", "Asi sikh r[] haa"],
  [1, 3, "The girls are singing.", "ਕੁੜੀਆਂ ਗਾ ਰ[riha:3] ਹਨ", "Kurhiaa gaa r[] han"],
  [1, 3, "You are speaking. (respectful)", "ਤੁਸੀਂ ਬੋਲ ਰ[riha:2] ਹੋ", "Tusi bol r[] ho"],
  [1, 3, "She eats and drinks.", "ਉਹ ਖਾ[nda:1] ਤੇ ਪੀ[nda:1] ਹੈ", "Oh khaa[] te pee[] hai"],
  [1, 3, "He comes and goes.", "ਉਹ ਆ[unda:0] ਤੇ ਜਾ[nda:0] ਹੈ", "Oh aa[] te jaa[] hai"],
  // Level 1, Week 4: can
  [1, 4, "I can speak. (man speaking)", "ਮੈਂ ਬੋਲ ਸਕ[da:0] ਹਾਂ", "Mai bol sak[] haa"],
  [1, 4, "I can speak. (woman speaking)", "ਮੈਂ ਬੋਲ ਸਕ[da:1] ਹਾਂ", "Mai bol sak[] haa"],
  [1, 4, "She can read.", "ਉਹ ਪੜ੍ਹ ਸਕ[da:1] ਹੈ", "Oh parh sak[] hai"],
  [1, 4, "He can sing.", "ਉਹ ਗਾ ਸਕ[da:0] ਹੈ", "Oh gaa sak[] hai"],
  [1, 4, "We can go. (mixed group)", "ਅਸੀਂ ਜਾ ਸਕ[da:2] ਹਾਂ", "Asi jaa sak[] haa"],
  [1, 4, "They can come. (girls)", "ਉਹ ਆ ਸਕ[da:3] ਹਨ", "Oh aa sak[] han"],
  [1, 4, "You can eat. (respectful)", "ਤੁਸੀਂ ਖਾ ਸਕ[da:2] ਹੋ", "Tusi khaa sak[] ho"],
  [1, 4, "I work because I can. (woman speaking)", "ਮੈਂ ਕੰਮ ਕਰ[da:1] ਹਾਂ ਕਿਉਂਕਿ ਮੈਂ ਕਰ ਸਕ[da:1] ਹਾਂ", "Mai kamm kar[] haa kyonki mai kar sak[] haa"],
  [1, 4, "He reads but she writes.", "ਉਹ ਪੜ੍ਹ[da:0] ਹੈ ਪਰ ਉਹ ਲਿਖ[da:1] ਹੈ", "Oh parh[] hai par oh likh[] hai"],

  // Level 2, Week 5: verbals
  [2, 5, "Reading is important.", "ਪੜ੍ਹ[verbalN:0] ਜ਼ਰੂਰੀ ਹੈ", "Parh[] zaroori hai"],
  [2, 5, "Working is important.", "ਕੰਮ ਕਰ[verbalN:0] ਜ਼ਰੂਰੀ ਹੈ", "Kamm kar[] zaroori hai"],
  [2, 5, "Speaking is easy.", "ਬੋਲ[verbalL:0] ਸੌਖਾ ਹੈ", "Bol[] saukha hai"],
  [2, 5, "Learning is good.", "ਸਿੱਖ[verbalL:0] ਚੰਗਾ ਹੈ", "Sikh[] changa hai"],
  [2, 5, "Writing is difficult.", "ਲਿਖ[verbalL:0] ਔਖਾ ਹੈ", "Likh[] aukha hai"],
  [2, 5, "Playing is fun.", "ਖੇਡ[verbalL:0] ਮਜ਼ੇਦਾਰ ਹੈ", "Khed[] mazedaar hai"],
  [2, 5, "Going is important.", "ਜਾ[verbalL:0] ਜ਼ਰੂਰੀ ਹੈ", "Jaa[] zaroori hai"],
  [2, 5, "Speaking is easy but writing is difficult.", "ਬੋਲ[verbalL:0] ਸੌਖਾ ਹੈ ਪਰ ਲਿਖ[verbalL:0] ਔਖਾ ਹੈ", "Bol[] saukha hai par likh[] aukha hai"],
  // Level 2, Week 6: want, need, have to
  [2, 6, "I want to read. (man speaking)", "ਮੈਂ ਪੜ੍ਹਨਾ ਚਾਹੁ[tippi:0] ਹਾਂ", "Mai parhna chahu[] haa"],
  [2, 6, "I want to read. (woman speaking)", "ਮੈਂ ਪੜ੍ਹਨਾ ਚਾਹੁ[tippi:1] ਹਾਂ", "Mai parhna chahu[] haa"],
  [2, 6, "She wants to speak.", "ਉਹ ਬੋਲਣਾ ਚਾਹੁ[tippi:1] ਹੈ", "Oh bolna chahu[] hai"],
  [2, 6, "He wants to go.", "ਉਹ ਜਾਣਾ ਚਾਹੁ[tippi:0] ਹੈ", "Oh jaana chahu[] hai"],
  [2, 6, "We want to learn. (mixed group)", "ਅਸੀਂ ਸਿੱਖਣਾ ਚਾਹੁ[tippi:2] ਹਾਂ", "Asi sikhna chahu[] haa"],
  [2, 6, "The girls want to play.", "ਕੁੜੀਆਂ ਖੇਡਣਾ ਚਾਹੁ[tippi:3] ਹਨ", "Kurhiaa khedna chahu[] han"],
  [2, 6, "I need water.", "ਮੈਨੂੰ ਪਾਣੀ ਚਾਹੀ[da:0] ਹੈ", "Mainu paani chahi[] hai"],
  [2, 6, "I need a book.", "ਮੈਨੂੰ ਕਿਤਾਬ ਚਾਹੀ[da:1] ਹੈ", "Mainu kitaab chahi[] hai"],
  [2, 6, "We need money.", "ਸਾਨੂੰ ਪੈਸੇ ਚਾਹੀ[da:2] ਹਨ", "Saanu paise chahi[] han"],
  [2, 6, "He needs books.", "ਉਸਨੂੰ ਕਿਤਾਬਾਂ ਚਾਹੀ[da:3] ਹਨ", "Osnu kitaabaa chahi[] han"],
  [2, 6, "You need a car.", "ਤੁਹਾਨੂੰ ਗੱਡੀ ਚਾਹੀ[da:1] ਹੈ", "Tuhanu gaddi chahi[] hai"],
  [2, 6, "They need a house.", "ਉਹਨਾਂ ਨੂੰ ਘਰ ਚਾਹੀ[da:0] ਹੈ", "Ohnaa nu ghar chahi[] hai"],
  [2, 6, "I have to work.", "ਮੈਨੂੰ ਕੰਮ ਕਰਨਾ ਪੈਂ[da:0] ਹੈ", "Mainu kamm karna pain[] hai"],
  [2, 6, "I have to read a book.", "ਮੈਨੂੰ ਕਿਤਾਬ ਪੜ੍ਹਨੀ ਪੈਂ[da:1] ਹੈ", "Mainu kitaab parhni pain[] hai"],
  [2, 6, "We have to wash the clothes.", "ਸਾਨੂੰ ਕੱਪੜੇ ਧੋਣੇ ਪੈਂ[da:2] ਹਨ", "Saanu kaprhe dhone pain[] han"],
  [2, 6, "She has to write letters.", "ਉਸਨੂੰ ਚਿੱਠੀਆਂ ਲਿਖਣੀਆਂ ਪੈਂ[da:3] ਹਨ", "Osnu chitthiaa likhniaa pain[] han"],
  [2, 6, "I want to eat because I need food. (man speaking)", "ਮੈਂ ਖਾਣਾ ਚਾਹੁ[tippi:0] ਹਾਂ ਕਿਉਂਕਿ ਮੈਨੂੰ ਰੋਟੀ ਚਾਹੀ[da:1] ਹੈ", "Mai khaana chahu[] haa kyonki mainu roti chahi[] hai"],
  // Level 2, Week 7: negatives and adjectives
  [2, 7, "I don't eat meat. (woman speaking)", "ਮੈਂ ਮੀਟ ਨਹੀਂ ਖਾ[nda:1]", "Mai meat nahi khaa[]"],
  [2, 7, "He doesn't speak.", "ਉਹ ਨਹੀਂ ਬੋਲ[da:0]", "Oh nahi bol[]"],
  [2, 7, "We don't go. (mixed group)", "ਅਸੀਂ ਨਹੀਂ ਜਾ[nda:2]", "Asi nahi jaa[]"],
  [2, 7, "A good boy.", "ਚੰਗ[adj:0] ਮੁੰਡਾ", "Chang[] munda"],
  [2, 7, "A good girl.", "ਚੰਗ[adj:1] ਕੁੜੀ", "Chang[] kurhi"],
  [2, 7, "Good boys.", "ਚੰਗ[adj:2] ਮੁੰਡੇ", "Chang[] munde"],
  [2, 7, "Good girls.", "ਚੰਗ[adj:3] ਕੁੜੀਆਂ", "Chang[] kurhiaa"],
  [2, 7, "A big house.", "ਵੱਡ[adj:0] ਘਰ", "Vadd[] ghar"],
  [2, 7, "A big car.", "ਵੱਡ[adj:1] ਗੱਡੀ", "Vadd[] gaddi"],
  [2, 7, "A small dog.", "ਛੋਟ[adj:0] ਕੁੱਤਾ", "Chhot[] kutta"],
  [2, 7, "A small cat.", "ਛੋਟ[adj:1] ਬਿੱਲੀ", "Chhot[] billi"],
  [2, 7, "The boy is tall.", "ਮੁੰਡਾ ਲੰਮ[adj:0] ਹੈ", "Munda lamm[] hai"],
  [2, 7, "The girl is tall.", "ਕੁੜੀ ਲੰਮ[adj:1] ਹੈ", "Kurhi lamm[] hai"],
  [2, 7, "The boys are tall.", "ਮੁੰਡੇ ਲੰਮ[adj:2] ਹਨ", "Munde lamm[] han"],
  [2, 7, "The girls are tall.", "ਕੁੜੀਆਂ ਲੰਮ[adj:3] ਹਨ", "Kurhiaa lamm[] han"],
  [2, 7, "The tea is good.", "ਚਾਹ ਚੰਗ[adj:1] ਹੈ", "Chaah chang[] hai"],
  [2, 7, "The food is good.", "ਖਾਣਾ ਚੰਗ[adj:0] ਹੈ", "Khaana chang[] hai"],
  [2, 7, "A new shirt.", "ਨਵ[nav:1] ਕਮੀਜ਼", "Nav[] kameez"],
  [2, 7, "New clothes.", "ਨਵ[nav:2] ਕੱਪੜੇ", "Nav[] kaprhe"],
  [2, 7, "The big house is new.", "ਵੱਡ[adj:0] ਘਰ ਨਵ[nav:0] ਹੈ", "Vadd[] ghar nav[] hai"],
  [2, 7, "The big car is new.", "ਵੱਡ[adj:1] ਗੱਡੀ ਨਵ[nav:1] ਹੈ", "Vadd[] gaddi nav[] hai"],
  [2, 7, "The small girls are good.", "ਛੋਟ[adj:3] ਕੁੜੀਆਂ ਚੰਗ[adj:3] ਹਨ", "Chhot[] kurhiaa chang[] han"],
  [2, 7, "The small boys are good.", "ਛੋਟ[adj:2] ਮੁੰਡੇ ਚੰਗ[adj:2] ਹਨ", "Chhot[] munde chang[] han"],
  [2, 7, "The good girl sings.", "ਚੰਗ[adj:1] ਕੁੜੀ ਗਾ[unda:1] ਹੈ", "Chang[] kurhi gaa[] hai"],
  [2, 7, "The small boy plays.", "ਛੋਟ[adj:0] ਮੁੰਡਾ ਖੇਡ[da:0] ਹੈ", "Chhot[] munda khed[] hai"],
  // Level 2, Week 8: past
  [2, 8, "I came. (man speaking)", "ਮੈਂ ਆ[aaya:0]", "Mai aa[]"],
  [2, 8, "I came. (woman speaking)", "ਮੈਂ ਆ[aaya:1]", "Mai aa[]"],
  [2, 8, "They came. (boys)", "ਉਹ ਆ[aaya:2] ਸਨ", "Oh aa[] san"],
  [2, 8, "They came. (girls)", "ਉਹ ਆ[aaya:3] ਸਨ", "Oh aa[] san"],
  [2, 8, "He went home.", "ਉਹ ਘਰ ਗ[gaya:0]", "Oh ghar g[]"],
  [2, 8, "She went home.", "ਉਹ ਘਰ ਗ[gaya:1]", "Oh ghar g[]"],
  [2, 8, "We went to school. (mixed group)", "ਅਸੀਂ ਸਕੂਲ ਗ[gaya:2]", "Asi school g[]"],
  [2, 8, "The girls went.", "ਕੁੜੀਆਂ ਗ[gaya:3]", "Kurhiaa g[]"],
  [2, 8, "I did the work.", "ਮੈਂ ਕੰਮ ਕੀਤ[adj:0]", "Mai kamm keet[]"],
  [2, 8, "I ate the roti.", "ਮੈਂ ਰੋਟੀ ਖਾਧ[adj:1]", "Mai roti khaadh[]"],
  [2, 8, "I ate an apple.", "ਮੈਂ ਸੇਬ ਖਾਧ[adj:0]", "Mai seb khaadh[]"],
  [2, 8, "I drank tea.", "ਮੈਂ ਚਾਹ ਪੀਤ[adj:1]", "Mai chaah peet[]"],
  [2, 8, "I drank water.", "ਮੈਂ ਪਾਣੀ ਪੀਤ[adj:0]", "Mai paani peet[]"],
  [2, 8, "I read the book.", "ਮੈਂ ਕਿਤਾਬ ਪੜ੍ਹ[ia:1]", "Mai kitaab parh[]"],
  [2, 8, "I wrote a letter (masculine: ਖ਼ਤ).", "ਮੈਂ ਖ਼ਤ ਲਿਖ[ia:0]", "Mai khat likh[]"],
  [2, 8, "I wrote a letter (feminine: ਚਿੱਠੀ).", "ਮੈਂ ਚਿੱਠੀ ਲਿਖ[ia:1]", "Mai chitthi likh[]"],
  [2, 8, "I gave the money.", "ਮੈਂ ਪੈਸੇ ਦਿੱਤ[adj:2]", "Mai paise ditt[]"],
  [2, 8, "I used to work. (woman speaking)", "ਮੈਂ ਕੰਮ ਕਰ[da:1] ਸੀ", "Mai kamm kar[] si"],
  [2, 8, "I used to work. (man speaking)", "ਮੈਂ ਕੰਮ ਕਰ[da:0] ਸੀ", "Mai kamm kar[] si"],
  [2, 8, "They used to speak. (boys)", "ਉਹ ਬੋਲ[da:2] ਸਨ", "Oh bol[] san"],
  [2, 8, "They used to speak. (girls)", "ਉਹ ਬੋਲ[da:3] ਸਨ", "Oh bol[] san"],
  [2, 8, "She used to sing.", "ਉਹ ਗਾ[unda:1] ਸੀ", "Oh gaa[] si"],
  [2, 8, "I was working. (woman speaking)", "ਮੈਂ ਕੰਮ ਕਰ ਰ[riha:1] ਸੀ", "Mai kamm kar r[] si"],
  [2, 8, "He was eating.", "ਉਹ ਖਾ ਰ[riha:0] ਸੀ", "Oh khaa r[] si"],
  [2, 8, "We were going. (mixed group)", "ਅਸੀਂ ਜਾ ਰ[riha:2] ਸੀ", "Asi jaa r[] si"],
  [2, 8, "The girls were singing.", "ਕੁੜੀਆਂ ਗਾ ਰ[riha:3] ਸਨ", "Kurhiaa gaa r[] san"],
  [2, 8, "I could speak. (man speaking)", "ਮੈਂ ਬੋਲ ਸਕ[da:0] ਸੀ", "Mai bol sak[] si"],
  [2, 8, "She could read.", "ਉਹ ਪੜ੍ਹ ਸਕ[da:1] ਸੀ", "Oh parh sak[] si"],
  [2, 8, "We could go. (mixed group)", "ਅਸੀਂ ਜਾ ਸਕ[da:2] ਸੀ", "Asi jaa sak[] si"],
  [2, 8, "She came and ate the roti.", "ਉਹ ਆ[aaya:1] ਤੇ ਰੋਟੀ ਖਾਧ[adj:1]", "Oh aa[] te roti khaadh[]"],
  [2, 8, "He went and did the work.", "ਉਹ ਗ[gaya:0] ਤੇ ਕੰਮ ਕੀਤ[adj:0]", "Oh g[] te kamm keet[]"],

  // Level 3, Week 9: future
  [3, 9, "I will read. (man speaking)", "ਮੈਂ ਪੜ੍ਹ[futC:0]", "Mai parh[]"],
  [3, 9, "I will read. (woman speaking)", "ਮੈਂ ਪੜ੍ਹ[futC:1]", "Mai parh[]"],
  [3, 9, "We will speak.", "ਅਸੀਂ ਬੋਲ[futC:2]", "Asi bol[]"],
  [3, 9, "He will work.", "ਉਹ ਕੰਮ ਕਰ[futC2:0]", "Oh kamm kar[]"],
  [3, 9, "She will work.", "ਉਹ ਕੰਮ ਕਰ[futC2:1]", "Oh kamm kar[]"],
  [3, 9, "You will write. (respectful)", "ਤੁਸੀਂ ਲਿਖ[futC2:2]", "Tusi likh[]"],
  [3, 9, "They will read. (boys)", "ਉਹ ਪੜ੍ਹ[futC3:0]", "Oh parh[]"],
  [3, 9, "They will read. (girls)", "ਉਹ ਪੜ੍ਹ[futC3:1]", "Oh parh[]"],
  [3, 9, "I will come. (man speaking)", "ਮੈਂ ਆ[futV:0]", "Mai aa[]"],
  [3, 9, "I will come. (woman speaking)", "ਮੈਂ ਆ[futV:1]", "Mai aa[]"],
  [3, 9, "We will go tomorrow.", "ਅਸੀਂ ਕੱਲ੍ਹ ਜਾ[futV:2]", "Asi kal jaa[]"],
  [3, 9, "He will come.", "ਉਹ ਆ[futV2:0]", "Oh aa[]"],
  [3, 9, "She will go.", "ਉਹ ਜਾ[futV2:1]", "Oh jaa[]"],
  [3, 9, "You will eat. (respectful)", "ਤੁਸੀਂ ਖਾ[futV2:2]", "Tusi khaa[]"],
  [3, 9, "They will come. (boys)", "ਉਹ ਆ[futAa:0]", "Oh aa[]"],
  [3, 9, "They will go. (girls)", "ਉਹ ਜਾ[futV3:1]", "Oh jaa[]"],
  [3, 9, "I will be able to speak. (man speaking)", "ਮੈਂ ਬੋਲ ਸਕ[futC:0]", "Mai bol sak[]"],
  [3, 9, "I will be able to speak. (woman speaking)", "ਮੈਂ ਬੋਲ ਸਕ[futC:1]", "Mai bol sak[]"],
  [3, 9, "She will be able to read.", "ਉਹ ਪੜ੍ਹ ਸਕ[futC2:1]", "Oh parh sak[]"],
  [3, 9, "We will be able to go.", "ਅਸੀਂ ਜਾ ਸਕ[futC:2]", "Asi jaa sak[]"],
  [3, 9, "He will come and eat.", "ਉਹ ਆ[futV2:0] ਤੇ ਖਾ[futV2:0]", "Oh aa[] te khaa[]"],
  [3, 9, "She will come and sing.", "ਉਹ ਆ[futV2:1] ਤੇ ਗਾ[futV2:1]", "Oh aa[] te gaa[]"],
  [3, 9, "I will read and write. (woman speaking)", "ਮੈਂ ਪੜ੍ਹ[futC:1] ਤੇ ਲਿਖ[futC:1]", "Mai parh[] te likh[]"],
  // Level 3, Week 10: commands and possessives
  [3, 10, "Please speak. (respectful)", "ਕਿਰਪਾ ਕਰਕੇ ਬੋਲ[impC:0]", "Kirpa karke bol[]"],
  [3, 10, "Write this. (respectful)", "ਇਹ ਲਿਖ[impC:0]", "Eh likh[]"],
  [3, 10, "Do the work. (respectful)", "ਕੰਮ ਕਰ[impC:0]", "Kamm kar[]"],
  [3, 10, "Go home. (respectful)", "ਘਰ ਜਾ[impV:0]", "Ghar jaa[]"],
  [3, 10, "Come here. (respectful)", "ਇੱਥੇ ਆ[impV:0]", "Ithe aa[]"],
  [3, 10, "Eat the roti. (respectful)", "ਰੋਟੀ ਖਾ[impV:0]", "Roti khaa[]"],
  [3, 10, "Come and sit. (respectful)", "ਆ[impV:0] ਤੇ ਬੈਠ[impC:0]", "Aa[] te baith[]"],
  [3, 10, "My brother.", "ਮੇਰ[adj:0] ਭਰਾ", "Mer[] bhra"],
  [3, 10, "My sister.", "ਮੇਰ[adj:1] ਭੈਣ", "Mer[] bhain"],
  [3, 10, "My brothers.", "ਮੇਰ[adj:2] ਭਰਾ", "Mer[] bhra"],
  [3, 10, "My sisters.", "ਮੇਰ[adj:3] ਭੈਣਾਂ", "Mer[] bhainaa"],
  [3, 10, "Your house. (respectful)", "ਤੁਹਾਡ[adj:0] ਘਰ", "Tuhaad[] ghar"],
  [3, 10, "Your car. (respectful)", "ਤੁਹਾਡ[adj:1] ਗੱਡੀ", "Tuhaad[] gaddi"],
  [3, 10, "Our friends. (male friends)", "ਸਾਡ[adj:2] ਦੋਸਤ", "Saad[] dost"],
  [3, 10, "His book.", "ਉਸ[da:1] ਕਿਤਾਬ", "Os[] kitaab"],
  [3, 10, "Her book.", "ਉਸ[da:1] ਕਿਤਾਬ", "Os[] kitaab"],
  [3, 10, "Her house.", "ਉਸ[da:0] ਘਰ", "Os[] ghar"],
  [3, 10, "His shoes (feminine: ਜੁੱਤੀਆਂ).", "ਉਸ[da:3] ਜੁੱਤੀਆਂ", "Os[] juttiaa"],
  [3, 10, "I read my own book.", "ਮੈਂ ਆਪਣ[adj:1] ਕਿਤਾਬ ਪੜ੍ਹ[ia:1]", "Mai apn[] kitaab parh[]"],
  [3, 10, "He lives in his own house.", "ਉਹ ਆਪਣ[adj:2] ਘਰ ਵਿੱਚ ਰਹਿ[tippi:0] ਹੈ", "Oh apn[] ghar vich reh[] hai"],
  [3, 10, "My brother's car.", "ਮੇਰੇ ਭਰਾ [da:1] ਗੱਡੀ", "Mere bhra [] gaddi"],
  [3, 10, "My sister's house.", "ਮੇਰੀ ਭੈਣ [da:0] ਘਰ", "Meri bhain [] ghar"],
  [3, 10, "The boy's clothes.", "ਮੁੰਡੇ [da:2] ਕੱਪੜੇ", "Munde [] kaprhe"],
  [3, 10, "The girl's shoes (feminine: ਜੁੱਤੀਆਂ).", "ਕੁੜੀ [da:3] ਜੁੱਤੀਆਂ", "Kurhi [] juttiaa"],
  [3, 10, "My sister is tall.", "ਮੇਰ[adj:1] ਭੈਣ ਲੰਮ[adj:1] ਹੈ", "Mer[] bhain lamm[] hai"],
  [3, 10, "My brother is tall.", "ਮੇਰ[adj:0] ਭਰਾ ਲੰਮ[adj:0] ਹੈ", "Mer[] bhra lamm[] hai"],
  [3, 10, "My mum makes good food.", "ਮੇਰ[adj:1] ਮਾਂ ਚੰਗ[adj:0] ਖਾਣਾ ਬਣਾ[unda:1] ਹੈ", "Mer[] maa chang[] khaana banaa[] hai"],
  [3, 10, "Your sister sings good songs.", "ਤੁਹਾਡ[adj:1] ਭੈਣ ਚੰਗ[adj:2] ਗੀਤ ਗਾ[unda:1] ਹੈ", "Tuhaad[] bhain chang[] geet gaa[] hai"],

  // Level 4: possessive chains, ne, light verbs, about to
  [4, 0, "My friend's sister's house.", "ਮੇਰੇ ਦੋਸਤ [da:1] ਭੈਣ [da:0] ਘਰ", "Mere dost [] bhain [] ghar"],
  [4, 0, "My sister's friend's car.", "ਮੇਰੀ ਭੈਣ ਦੇ ਦੋਸਤ [da:1] ਗੱਡੀ", "Meri bhain de dost [] gaddi"],
  [4, 0, "My brother's wife's mother.", "ਮੇਰੇ ਭਰਾ [da:1] ਪਤਨੀ [da:1] ਮਾਂ", "Mere bhra [] patni [] maa"],
  [4, 0, "The teacher's son's books.", "ਅਧਿਆਪਕ ਦੇ ਪੁੱਤ [da:3] ਕਿਤਾਬਾਂ", "Adhiapak de putt [] kitaabaa"],
  [4, 0, "My mum's sister's children.", "ਮੇਰੀ ਮਾਂ [da:1] ਭੈਣ [da:2] ਬੱਚੇ", "Meri maa [] bhain [] bachche"],
  [4, 0, "Your friend's dog's name.", "ਤੁਹਾਡੇ ਦੋਸਤ ਦੇ ਕੁੱਤੇ [da:0] ਨਾਮ", "Tuhade dost de kutte [] naam"],
  [4, 0, "He ate the roti.", "ਉਸਨੇ ਰੋਟੀ ਖਾਧ[adj:1]", "Osne roti khaadh[]"],
  [4, 0, "She ate an apple.", "ਉਸਨੇ ਸੇਬ ਖਾਧ[adj:0]", "Osne seb khaadh[]"],
  [4, 0, "She ate the apples.", "ਉਸਨੇ ਸੇਬ ਖਾਧ[adj:2]", "Osne seb khaadh[]"],
  [4, 0, "He read the books.", "ਉਸਨੇ ਕਿਤਾਬਾਂ ਪੜ੍ਹ[ia:3]", "Osne kitaabaa parh[]"],
  [4, 0, "She wrote a letter (masculine: ਖ਼ਤ).", "ਉਸਨੇ ਖ਼ਤ ਲਿਖ[ia:0]", "Osne khat likh[]"],
  [4, 0, "The boy washed the clothes.", "ਮੁੰਡੇ ਨੇ ਕੱਪੜੇ ਧੋਤ[adj:2]", "Munde ne kaprhe dhot[]"],
  [4, 0, "The girl did the work.", "ਕੁੜੀ ਨੇ ਕੰਮ ਕੀਤ[adj:0]", "Kurhi ne kamm keet[]"],
  [4, 0, "We saw the film.", "ਅਸੀਂ ਫ਼ਿਲਮ ਦੇਖ[ia:1]", "Asi film dekh[]"],
  [4, 0, "I bought a new car.", "ਮੈਂ ਨਵ[nav:1] ਗੱਡੀ ਖ਼ਰੀਦ[ia:1]", "Mai nav[] gaddi khareed[]"],
  [4, 0, "She made good food.", "ਉਸਨੇ ਚੰਗ[adj:0] ਖਾਣਾ ਬਣਾ[aaya:0]", "Osne chang[] khaana banaa[]"],
  [4, 0, "He read a new book.", "ਉਸਨੇ ਨਵ[nav:1] ਕਿਤਾਬ ਪੜ੍ਹ[ia:1]", "Osne nav[] kitaab parh[]"],
  [4, 0, "She has come.", "ਉਹ ਆ[aaya:1] ਹੈ", "Oh aa[] hai"],
  [4, 0, "He has gone.", "ਉਹ ਗ[gaya:0] ਹੈ", "Oh g[] hai"],
  [4, 0, "They have come. (girls)", "ਉਹ ਆ[aaya:3] ਹਨ", "Oh aa[] han"],
  [4, 0, "I have done the work.", "ਮੈਂ ਕੰਮ ਕੀਤ[adj:0] ਹੈ", "Mai kamm keet[] hai"],
  [4, 0, "She went to sleep.", "ਉਹ ਸੌਂ ਗ[gaya:1]", "Oh saun g[]"],
  [4, 0, "He went to sleep.", "ਉਹ ਸੌਂ ਗ[gaya:0]", "Oh saun g[]"],
  [4, 0, "I ate up the roti.", "ਮੈਂ ਰੋਟੀ ਖਾ ਲ[gaya:1]", "Mai roti khaa l[]"],
  [4, 0, "She told the thing (feminine: ਗੱਲ).", "ਉਸਨੇ ਗੱਲ ਦੱਸ ਦਿੱਤ[adj:1]", "Osne gall dass ditt[]"],
  [4, 0, "He gave the book.", "ਉਸਨੇ ਕਿਤਾਬ ਦੇ ਦਿੱਤ[adj:1]", "Osne kitaab de ditt[]"],
  [4, 0, "I am about to go. (man speaking)", "ਮੈਂ ਜਾਣ ਵਾਲ[vala:0] ਹਾਂ", "Mai jaan vaal[] haa"],
  [4, 0, "I am about to go. (woman speaking)", "ਮੈਂ ਜਾਣ ਵਾਲ[vala:1] ਹਾਂ", "Mai jaan vaal[] haa"],
  [4, 0, "We are about to eat. (mixed group)", "ਅਸੀਂ ਖਾਣ ਵਾਲ[vala:2] ਹਾਂ", "Asi khaan vaal[] haa"],
  [4, 0, "The girls are about to come.", "ਕੁੜੀਆਂ ਆਉਣ ਵਾਲ[vala:3] ਹਨ", "Kurhiaa aaun vaal[] han"],
  [4, 0, "The first day.", "ਪਹਿਲ[adj:0] ਦਿਨ", "Pehl[] din"],
  [4, 0, "The second week (masculine: ਹਫ਼ਤਾ).", "ਦੂਜ[adj:0] ਹਫ਼ਤਾ", "Dooj[] hafta"],
  [4, 0, "The third time (feminine: ਵਾਰ).", "ਤੀਜ[adj:1] ਵਾਰ", "Teej[] vaar"],
  [4, 0, "I will have finished it. (man speaking)", "ਮੈਂ ਮੁਕਾ ਚੁੱਕ[adj:0] ਹੋਵਾਂਗਾ", "Mai muka chukk[] hovaanga"],

  // Level 5: plurals before position words, comparing, feelings, describing
  [5, 0, "To the boys.", "ਮੁੰਡ[obl:0] ਨੂੰ", "Mund[] nu"],
  [5, 0, "To the boy.", "ਮੁੰਡ[obl:1] ਨੂੰ", "Mund[] nu"],
  [5, 0, "To the girls.", "ਕੁੜ[oblF:0] ਨੂੰ", "Kurh[] nu"],
  [5, 0, "To the girl.", "ਕੁੜ[oblF:1] ਨੂੰ", "Kurh[] nu"],
  [5, 0, "Give the books to the children.", "ਬੱਚ[obl:0] ਨੂੰ ਕਿਤਾਬਾਂ ਦਿਓ", "Bachch[] nu kitaabaa dio"],
  [5, 0, "In the rooms.", "ਕਮਰ[obl:0] ਵਿੱਚ", "Kamr[] vich"],
  [5, 0, "In the room.", "ਕਮਰ[obl:1] ਵਿੱਚ", "Kamr[] vich"],
  [5, 0, "With the dogs.", "ਕੁੱਤ[obl:0] ਨਾਲ", "Kutt[] naal"],
  [5, 0, "To the big boy.", "ਵੱਡ[adj:2] ਮੁੰਡ[obl:1] ਨੂੰ", "Vadd[] mund[] nu"],
  [5, 0, "To the big boys.", "ਵੱਡ[adj:2] ਮੁੰਡ[obl:0] ਨੂੰ", "Vadd[] mund[] nu"],
  [5, 0, "To the small girl.", "ਛੋਟ[adj:1] ਕੁੜ[oblF:1] ਨੂੰ", "Chhot[] kurh[] nu"],
  [5, 0, "In the big room.", "ਵੱਡ[adj:2] ਕਮਰ[obl:1] ਵਿੱਚ", "Vadd[] kamr[] vich"],
  [5, 0, "In my house.", "ਮੇਰ[adj:2] ਘਰ ਵਿੱਚ", "Mer[] ghar vich"],
  [5, 0, "With your sister.", "ਤੁਹਾਡ[adj:1] ਭੈਣ ਨਾਲ", "Tuhaad[] bhain naal"],
  [5, 0, "With his brother.", "ਉਸ[da:2] ਭਰਾ ਨਾਲ", "Os[] bhra naal"],
  [5, 0, "I have two cars.", "ਮੇਰੇ ਕੋਲ ਦੋ ਗੱਡ[iaan:0] ਹਨ", "Mere kol do gadd[] han"],
  [5, 0, "We have two dogs.", "ਸਾਡੇ ਕੋਲ ਦੋ ਕੁੱਤ[plural:0] ਹਨ", "Saade kol do kutt[] han"],
  [5, 0, "There are three books on the table.", "ਮੇਜ਼ ਉੱਤੇ ਤਿੰਨ ਕਿਤਾਬ[pluralF:0] ਹਨ", "Mez utte tinn kitaab[] han"],
  [5, 0, "My sister is taller than me.", "ਮੇਰੀ ਭੈਣ ਮੇਰੇ ਨਾਲੋਂ ਲੰਮ[adj:1] ਹੈ", "Meri bhain mere naalon lamm[] hai"],
  [5, 0, "My brother is bigger than me.", "ਮੇਰਾ ਭਰਾ ਮੇਰੇ ਨਾਲੋਂ ਵੱਡ[adj:0] ਹੈ", "Mera bhra mere naalon vadd[] hai"],
  [5, 0, "This car is the best of all.", "ਇਹ ਗੱਡੀ ਸਭ ਤੋਂ ਚੰਗ[adj:1] ਹੈ", "Eh gaddi sabh ton chang[] hai"],
  [5, 0, "She is like my mum.", "ਉਹ ਮੇਰੀ ਮਾਂ ਵਰਗ[adj:1] ਹੈ", "Oh meri maa varg[] hai"],
  [5, 0, "He is like my brother.", "ਉਹ ਮੇਰੇ ਭਰਾ ਵਰਗ[adj:0] ਹੈ", "Oh mere bhra varg[] hai"],
  [5, 0, "My sister is taller than my brother.", "ਮੇਰ[adj:1] ਭੈਣ ਮੇਰ[adj:2] ਭਰਾ ਨਾਲੋਂ ਲੰਮ[adj:1] ਹੈ", "Mer[] bhain mer[] bhra naalon lamm[] hai"],
  [5, 0, "The man with the red turban.", "ਲਾਲ ਪੱਗ ਵਾਲ[vala:0] ਆਦਮੀ", "Laal pagg vaal[] aadmi"],
  [5, 0, "The woman with the red shirt.", "ਲਾਲ ਕਮੀਜ਼ ਵਾਲ[vala:1] ਔਰਤ", "Laal kameez vaal[] aurat"],
  [5, 0, "The boys with the big bags.", "ਵੱਡ[adj:2] ਬੈਗਾਂ ਵਾਲ[vala:2] ਮੁੰਡੇ", "Vadd[] bagaa vaal[] munde"],
  [5, 0, "I am hungry.", "ਮੈਨੂੰ ਭੁੱਖ ਲੱਗ[ia:1] ਹੈ", "Mainu bhukkh lagg[] hai"],
  [5, 0, "I am thirsty.", "ਮੈਨੂੰ ਪਿਆਸ ਲੱਗ[ia:1] ਹੈ", "Mainu pyaas lagg[] hai"],
  [5, 0, "I felt scared.", "ਮੈਨੂੰ ਡਰ ਲੱਗ[ia:0]", "Mainu darr lagg[]"],
  [5, 0, "She felt cold.", "ਉਸਨੂੰ ਠੰਢ ਲੱਗ[ia:1]", "Osnu thandh lagg[]"],
  [5, 0, "I know Punjabi.", "ਮੈਨੂੰ ਪੰਜਾਬੀ ਆ[unda:1] ਹੈ", "Mainu Punjabi aa[] hai"],
  [5, 0, "I think of you.", "ਮੈਨੂੰ ਤੁਹਾਡਾ ਖ਼ਿਆਲ ਆ[unda:0] ਹੈ", "Mainu tuhada khiaal aa[] hai"],
  [5, 0, "I miss my mum.", "ਮੈਨੂੰ ਮਾਂ ਦੀ ਯਾਦ ਆ[unda:1] ਹੈ", "Mainu maa di yaad aa[] hai"],

  // Level 6: joining, had, if, wishes, advice
  [6, 0, "She had made the food.", "ਉਹ ਖਾਣਾ ਬਣਾ ਚੁੱਕ[adj:1] ਸੀ", "Oh khaana bana chukk[] si"],
  [6, 0, "He had made the food.", "ਉਹ ਖਾਣਾ ਬਣਾ ਚੁੱਕ[adj:0] ਸੀ", "Oh khaana bana chukk[] si"],
  [6, 0, "We had eaten. (mixed group)", "ਅਸੀਂ ਖਾ ਚੁੱਕ[adj:2] ਸੀ", "Asi khaa chukk[] si"],
  [6, 0, "The girls had gone.", "ਕੁੜੀਆਂ ਜਾ ਚੁੱਕ[adj:3] ਸਨ", "Kurhiaa jaa chukk[] san"],
  [6, 0, "I had to go.", "ਮੈਨੂੰ ਜਾਣਾ ਪ[pia:0]", "Mainu jaana p[]"],
  [6, 0, "I had to read a book.", "ਮੈਨੂੰ ਕਿਤਾਬ ਪੜ੍ਹਨੀ ਪ[pia:1]", "Mainu kitaab parhni p[]"],
  [6, 0, "We had to wash the clothes.", "ਸਾਨੂੰ ਕੱਪੜੇ ਧੋਣੇ ਪ[pia:2]", "Saanu kaprhe dhone p[]"],
  [6, 0, "She suddenly started crying.", "ਉਹ ਰੋਣ ਲੱਗ ਪ[pia:1]", "Oh ron lagg p[]"],
  [6, 0, "He suddenly started laughing.", "ਉਹ ਹੱਸਣ ਲੱਗ ਪ[pia:0]", "Oh hassan lagg p[]"],
  [6, 0, "The children started playing.", "ਬੱਚੇ ਖੇਡਣ ਲੱਗ ਪ[pia:2]", "Bachche khedan lagg p[]"],
  [6, 0, "After washing his hands, he ate.", "ਹੱਥ ਧੋ ਕੇ ਉਸਨੇ ਖਾਣਾ ਖਾਧ[adj:0]", "Hath dho ke osne khaana khaadh[]"],
  [6, 0, "After reading the book, she slept.", "ਕਿਤਾਬ ਪੜ੍ਹ ਕੇ ਉਹ ਸੌਂ ਗ[gaya:1]", "Kitaab parh ke oh saun g[]"],
  [6, 0, "If you come, I will go. (woman speaking)", "ਜੇ ਤੁਸੀਂ ਆ[subjV:3] ਤਾਂ ਮੈਂ ਜਾ[futV:1]", "Je tusi aa[] taa mai jaa[]"],
  [6, 0, "If it rains, we will not go.", "ਜੇ ਮੀਂਹ ਪ[subjV:1] ਤਾਂ ਅਸੀਂ ਨਹੀਂ ਜਾ[futV:2]", "Je meenh pa[] taa asi nahi jaa[]"],
  [6, 0, "If he reads, he will learn.", "ਜੇ ਉਹ ਪੜ੍ਹ[subjC2:1] ਤਾਂ ਉਹ ਸਿੱਖ[futC2:0]", "Je oh parh[] taa oh sikh[]"],
  [6, 0, "If she works, she will earn money.", "ਜੇ ਉਹ ਕੰਮ ਕਰ[subjC2:1] ਤਾਂ ਉਹ ਪੈਸੇ ਕਮਾ[futV2:1]", "Je oh kamm kar[] taa oh paise kamaa[]"],
  [6, 0, "I want him to come. (man speaking)", "ਮੈਂ ਚਾਹੁੰਦਾ ਹਾਂ ਕਿ ਉਹ ਆ[subjV:1]", "Mai chahunda haa ki oh aa[]"],
  [6, 0, "I want you to speak. (woman speaking)", "ਮੈਂ ਚਾਹੁੰਦੀ ਹਾਂ ਕਿ ਤੁਸੀਂ ਬੋਲ[subjC:3]", "Mai chahundi haa ki tusi bol[]"],
  [6, 0, "Let's read.", "ਪੜ੍ਹ[subjC:2]", "Parh[]"],
  [6, 0, "Let's eat.", "ਖਾ[subjV:2]", "Khaa[]"],
  [6, 0, "May I come?", "ਕੀ ਮੈਂ ਆ[subjV:0]?", "Ki mai aa[]?"],
  [6, 0, "Should I speak?", "ਕੀ ਮੈਂ ਬੋਲ[subjC:0]?", "Ki mai bol[]?"],
  [6, 0, "I want them to speak. (man speaking)", "ਮੈਂ ਚਾਹੁੰਦਾ ਹਾਂ ਕਿ ਉਹ ਬੋਲ[subjC2:0]", "Mai chahunda haa ki oh bol[]"],
  [6, 0, "You should read this book.", "ਤੁਹਾਨੂੰ ਇਹ ਕਿਤਾਬ ਪੜ੍ਹਨੀ ਚਾਹੀ[da:1] ਹੈ", "Tuhanu eh kitaab parhni chahi[] hai"],
  [6, 0, "You should do this work.", "ਤੁਹਾਨੂੰ ਇਹ ਕੰਮ ਕਰਨਾ ਚਾਹੀ[da:0] ਹੈ", "Tuhanu eh kamm karna chahi[] hai"],
  [6, 0, "You should eat fruit.", "ਤੁਹਾਨੂੰ ਫਲ ਖਾਣੇ ਚਾਹੀ[da:2] ਹਨ", "Tuhanu phal khaane chahi[] han"],
  [6, 0, "He is coming, isn't he?", "ਉਹ ਆ ਰ[riha:0] ਹੈ ਨਾ?", "Oh aa r[] hai na?"],
  [6, 0, "She knows, doesn't she?", "ਉਹ ਜਾਣ[da:1] ਹੈ ਨਾ?", "Oh jaan[] hai na?"],

  // Level 7: reported speech, stories, might and would, description
  [7, 0, "He said he would go to the village.", "ਉਹਨੇ ਕਿਹਾ ਕਿ ਉਹ ਪਿੰਡ ਜਾ[futV2:0]", "Ohne kiha ki oh pind jaa[]"],
  [7, 0, "She said she would come tomorrow.", "ਉਹਨੇ ਕਿਹਾ ਕਿ ਉਹ ਕੱਲ੍ਹ ਆ[futV2:1]", "Ohne kiha ki oh kal aa[]"],
  [7, 0, "My mum used to say effort never goes to waste.", "ਮੇਰੀ ਮਾਂ ਕਹਿ[tippi:1] ਸੀ ਕਿ ਮਿਹਨਤ ਕਦੇ ਬੇਕਾਰ ਨਹੀਂ ਜਾ[nda:1]", "Meri maa keh[] si ki mehnat kade bekaar nahi jaa[]"],
  [7, 0, "He told me he has got a job.", "ਉਹਨੇ ਮੈਨੂੰ ਦੱਸ[ia:0] ਕਿ ਉਹਨੂੰ ਨੌਕਰੀ ਮਿਲ ਗ[gaya:1] ਹੈ", "Ohne mainu dass[] ki ohnu naukri mil g[] hai"],
  [7, 0, "She told me her brother had gone.", "ਉਹਨੇ ਮੈਨੂੰ ਦੱਸ[ia:0] ਕਿ ਉਸਦਾ ਭਰਾ ਗ[gaya:0] ਸੀ", "Ohne mainu dass[] ki osda bhra g[] si"],
  [7, 0, "I feel we are forgetting our language. (mixed group)", "ਮੈਨੂੰ ਲੱਗ[da:0] ਹੈ ਕਿ ਅਸੀਂ ਆਪਣ[adj:1] ਬੋਲੀ ਭੁੱਲ ਰ[riha:2] ਹਾਂ", "Mainu lagg[] hai ki asi apn[] boli bhull r[] haa"],
  [7, 0, "If I were you, I wouldn't do this. (man speaking)", "ਜੇ ਮੈਂ ਤੁਹਾਡੀ ਥਾਂ ਹੁ[tippi:0], ਮੈਂ ਇਹ ਕੰਮ ਨਾ ਕਰ[da:0]", "Je mai tuhadi thaa hu[], mai eh kamm na kar[]"],
  [7, 0, "If I were you, I wouldn't go. (woman speaking)", "ਜੇ ਮੈਂ ਤੁਹਾਡੀ ਥਾਂ ਹੁ[tippi:1], ਮੈਂ ਨਾ ਜਾ[nda:1]", "Je mai tuhadi thaa hu[], mai na jaa[]"],
  [7, 0, "If he had read, he would have learned.", "ਜੇ ਉਹ ਪੜ੍ਹ[da:0] ਤਾਂ ਉਹ ਸਿੱਖ ਜਾ[nda:0]", "Je oh parh[] taa oh sikh jaa[]"],
  [7, 0, "She might come today.", "ਉਹ ਅੱਜ ਆ ਸਕ[da:1] ਹੈ", "Oh ajj aa sak[] hai"],
  [7, 0, "He might go tomorrow.", "ਸ਼ਾਇਦ ਉਹ ਕੱਲ੍ਹ ਜਾ[futV2:0]", "Shaayad oh kal jaa[]"],
  [7, 0, "The girl who came yesterday is my sister.", "ਜਿਹੜ[adj:1] ਕੁੜੀ ਕੱਲ੍ਹ ਆ[aaya:1] ਸੀ, ਉਹ ਮੇਰ[adj:1] ਭੈਣ ਹੈ", "Jehrh[] kurhi kal aa[] si, oh mer[] bhain hai"],
  [7, 0, "The boy who came yesterday is my brother.", "ਜਿਹੜ[adj:0] ਮੁੰਡਾ ਕੱਲ੍ਹ ਆ[aaya:0] ਸੀ, ਉਹ ਮੇਰ[adj:0] ਭਰਾ ਹੈ", "Jehrh[] munda kal aa[] si, oh mer[] bhra hai"],
  [7, 0, "The book that I read was good.", "ਜਿਹੜ[adj:1] ਕਿਤਾਬ ਮੈਂ ਪੜ੍ਹ[ia:1], ਉਹ ਚੰਗ[adj:1] ਸੀ", "Jehrh[] kitaab mai parh[], oh chang[] si"],
  [7, 0, "The children who were playing have gone home.", "ਜਿਹੜ[adj:2] ਬੱਚੇ ਖੇਡ ਰ[riha:2] ਸਨ, ਉਹ ਘਰ ਗ[gaya:2] ਹਨ", "Jehrh[] bachche khed r[] san, oh ghar g[] han"],
  [7, 0, "When I was small, I used to live in the village. (woman speaking)", "ਜਦੋਂ ਮੈਂ ਛੋਟ[adj:1] ਸੀ, ਮੈਂ ਪਿੰਡ ਰਹਿ[tippi:1] ਸੀ", "Jadon mai chhot[] si, mai pind reh[] si"],
  [7, 0, "When he was small, he used to play here.", "ਜਦੋਂ ਉਹ ਛੋਟ[adj:0] ਸੀ, ਉਹ ਇੱਥੇ ਖੇਡ[da:0] ਸੀ", "Jadon oh chhot[] si, oh ithe khed[] si"],
  [7, 0, "She was walking when it started to rain.", "ਉਹ ਤੁਰ ਰ[riha:1] ਸੀ ਜਦੋਂ ਮੀਂਹ ਪੈਣ ਲੱਗ[ia:0]", "Oh tur r[] si jadon meenh pain lagg[]"],
  [7, 0, "I would like some tea, please.", "ਮੈਨੂੰ ਥੋੜ੍ਹੀ ਚਾਹ ਚਾਹੀ[da:1] ਹੈ", "Mainu thorhi chaah chahi[] hai"],
  [7, 0, "Could you give me the book?", "ਕੀ ਤੁਸੀਂ ਮੈਨੂੰ ਕਿਤਾਬ ਦੇ ਸਕ[da:2] ਹੋ?", "Ki tusi mainu kitaab de sak[] ho?"],
  [7, 0, "In my opinion, this thing is not right.", "ਮੇਰ[adj:2] ਖ਼ਿਆਲ ਵਿੱਚ ਇਹ ਗੱਲ ਠੀਕ ਨਹੀਂ ਹੈ", "Mer[] khiaal vich eh gall theek nahi hai"],
  [7, 0, "I agree with your thought (feminine: ਗੱਲ).", "ਮੈਂ ਤੁਹਾਡ[adj:1] ਗੱਲ ਨਾਲ ਸਹਿਮਤ ਹਾਂ", "Mai tuhaad[] gall naal sehmat haa"],

  // Level 8: should and must, linking, natural speech
  [8, 0, "You really should do this work.", "ਤੁਹਾਨੂੰ ਇਹ ਕੰਮ ਜ਼ਰੂਰ ਕਰਨਾ ਚਾਹੀ[da:0] ਹੈ", "Tuhanu eh kamm zaroor karna chahi[] hai"],
  [8, 0, "She should have read the book.", "ਉਸਨੂੰ ਕਿਤਾਬ ਪੜ੍ਹਨੀ ਚਾਹੀ[da:1] ਸੀ", "Osnu kitaab parhni chahi[] si"],
  [8, 0, "He should have gone.", "ਉਸਨੂੰ ਜਾਣਾ ਚਾਹੀ[da:0] ਸੀ", "Osnu jaana chahi[] si"],
  [8, 0, "We should have bought the clothes.", "ਸਾਨੂੰ ਕੱਪੜੇ ਖ਼ਰੀਦਣੇ ਚਾਹੀ[da:2] ਸਨ", "Saanu kaprhe khareedne chahi[] san"],
  [8, 0, "They should have written the letters.", "ਉਹਨਾਂ ਨੂੰ ਚਿੱਠੀਆਂ ਲਿਖਣੀਆਂ ਚਾਹੀ[da:3] ਸਨ", "Ohnaa nu chitthiaa likhniaa chahi[] san"],
  [8, 0, "She must have gone home.", "ਉਹ ਘਰ ਗ[gaya:1] ਹੋਵੇਗੀ", "Oh ghar g[] hovegi"],
  [8, 0, "He must have gone home.", "ਉਹ ਘਰ ਗ[gaya:0] ਹੋਵੇਗਾ", "Oh ghar g[] hovega"],
  [8, 0, "They must have come. (girls)", "ਉਹ ਆ[aaya:3] ਹੋਣਗੀਆਂ", "Oh aa[] hongiaa"],
  [8, 0, "She must be sleeping.", "ਉਹ ਸੌਂ ਰ[riha:1] ਹੋਵੇਗੀ", "Oh saun r[] hovegi"],
  [8, 0, "He must be working.", "ਉਹ ਕੰਮ ਕਰ ਰ[riha:0] ਹੋਵੇਗਾ", "Oh kamm kar r[] hovega"],
  [8, 0, "Although she was tired, she kept working.", "ਭਾਵੇਂ ਉਹ ਥੱਕ[ia:1] ਹੋਈ ਸੀ, ਉਹ ਕੰਮ ਕਰ[da:1] ਰਹੀ", "Bhaaven oh thakk[] hoi si, oh kamm kar[] rahi"],
  [8, 0, "Although he was tired, he kept working.", "ਭਾਵੇਂ ਉਹ ਥੱਕ[ia:0] ਹੋਇਆ ਸੀ, ਉਹ ਕੰਮ ਕਰ[da:0] ਰਿਹਾ", "Bhaaven oh thakk[] hoia si, oh kamm kar[] riha"],
  [8, 0, "It was raining, but we went. (mixed group)", "ਮੀਂਹ ਪੈ ਰ[riha:0] ਸੀ, ਪਰ ਅਸੀਂ ਗ[gaya:2]", "Meenh pai r[] si, par asi g[]"],
  [8, 0, "While she was cooking, he was reading.", "ਜਦੋਂ ਉਹ ਖਾਣਾ ਬਣਾ ਰ[riha:1] ਸੀ, ਉਹ ਪੜ੍ਹ ਰ[riha:0] ਸੀ", "Jadon oh khaana bana r[] si, oh parh r[] si"],
  [8, 0, "Unless you read, you won't learn.", "ਜਦੋਂ ਤੱਕ ਤੁਸੀਂ ਨਹੀਂ ਪੜ੍ਹ[da:2], ਤੁਸੀਂ ਨਹੀਂ ਸਿੱਖ[futC2:2]", "Jadon takk tusi nahi parh[], tusi nahi sikh[]"],
  [8, 0, "So I went home. (woman speaking)", "ਇਸ ਲਈ ਮੈਂ ਘਰ ਗ[gaya:1]", "Is lai mai ghar g[]"],
  [8, 0, "Therefore he left the job.", "ਇਸ ਲਈ ਉਸਨੇ ਨੌਕਰੀ ਛੱਡ ਦਿੱਤ[adj:1]", "Is lai osne naukri chhadd ditt[]"],
  [8, 0, "Despite the rain, the children kept playing.", "ਮੀਂਹ ਦੇ ਬਾਵਜੂਦ ਬੱਚੇ ਖੇਡ[da:2] ਰਹੇ", "Meenh de baavajood bachche khed[] rahe"],
  [8, 0, "Come on, tell me!", "ਚੱਲ[subjC:3], ਮੈਨੂੰ ਦੱਸ[subjC:3]", "Chall[], mainu dass[]"],
  [8, 0, "I was just saying this. (woman speaking)", "ਮੈਂ ਤਾਂ ਬੱਸ ਇਹ ਕਹਿ ਰ[riha:1] ਸੀ", "Mai taa bas eh keh r[] si"],
  [8, 0, "My opinion is the same as yours (feminine: ਰਾਏ).", "ਮੇਰ[adj:1] ਰਾਏ ਵੀ ਤੁਹਾਡ[adj:1] ਰਾਏ ਵਰਗ[adj:1] ਹੈ", "Mer[] raae vi tuhaad[] raae varg[] hai"],
  [8, 0, "Your brother's new house is very big.", "ਤੁਹਾਡ[adj:2] ਭਰਾ ਦਾ ਨਵ[nav:0] ਘਰ ਬਹੁਤ ਵੱਡ[adj:0] ਹੈ", "Tuhaad[] bhra da nav[] ghar bahut vadd[] hai"],
  [8, 0, "My sister's new car is very big.", "ਮੇਰ[adj:1] ਭੈਣ ਦੀ ਨਵ[nav:1] ਗੱਡੀ ਬਹੁਤ ਵੱਡ[adj:1] ਹੈ", "Mer[] bhain di nav[] gaddi bahut vadd[] hai"],
];

export type EndingCard = { g: string; r: string };
export type EndingPart = { text: string } | { gap: number };
export type EndingQuestion = {
  id: string;
  level: number;
  week: number;
  english: string;
  parts: EndingPart[];
  romanParts: EndingPart[];
  answers: EndingCard[];
  cards: EndingCard[];
  gurmukhi: string;
  romanised: string;
};

const GAP = /\[(\w+):(\d)\]/g;

function splitParts(line: string, gap: RegExp): EndingPart[] {
  const parts: EndingPart[] = [];
  let last = 0;
  let index = 0;
  for (const match of line.matchAll(gap)) {
    if (match.index > last) parts.push({ text: line.slice(last, match.index) });
    parts.push({ gap: index });
    index += 1;
    last = match.index + match[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last) });
  return parts;
}

function joinParts(parts: EndingPart[], answers: string[]) {
  return parts.map((part) => ("text" in part ? part.text : answers[part.gap])).join("");
}

/** One gap gets four cards. Several gaps get up to six, always including every right answer. */
function cardsFor(sets: [string, string][][], answers: EndingCard[]): EndingCard[] {
  const limit = new Set(sets.map((set) => set.map(([g]) => g).join("|"))).size === 1 ? 4 : 6;
  const seen = new Set<string>();
  const cards: EndingCard[] = [];
  const add = (card: EndingCard) => {
    if (seen.has(card.g) || cards.length >= limit) return;
    seen.add(card.g);
    cards.push(card);
  };
  answers.forEach(add);
  for (let i = 0; cards.length < limit && i < 4; i += 1) {
    for (const set of sets) if (set[i]) add({ g: set[i][0], r: set[i][1] });
  }
  return cards;
}

function parseLine([level, week, english, gurmukhi, romanised]: EndingLine, index: number): EndingQuestion {
  const gaps = [...gurmukhi.matchAll(GAP)].map((m) => ({ set: ENDING_SETS[m[1]], right: Number(m[2]) }));
  const answers = gaps.map(({ set, right }) => ({ g: set[right][0], r: set[right][1] }));
  const parts = splitParts(gurmukhi, GAP);
  const romanParts = splitParts(romanised, /\[\]/g);
  return {
    id: `end-${index}`,
    level,
    week,
    english,
    parts,
    romanParts,
    answers,
    cards: cardsFor(gaps.map((g) => g.set), answers),
    gurmukhi: joinParts(parts, answers.map((a) => a.g)),
    romanised: joinParts(romanParts, answers.map((a) => a.r)),
  };
}

export const ENDING_QUESTIONS: EndingQuestion[] = ENDING_LINES.map(parseLine);
const ENDINGS_BY_ID = new Map(ENDING_QUESTIONS.map((q) => [q.id, q]));

export const endingById = (id: string) => ENDINGS_BY_ID.get(id);
export const endingsForLevel = (level: number) => ENDING_QUESTIONS.filter((q) => q.level === level);
/** Weeks 11 and 12 recap everything taught before them. */
export const endingsForWeek = (week: number) =>
  ENDING_QUESTIONS.filter((q) => q.week > 0 && (week >= 11 ? true : q.week === week));

/** Signs that attach to the letter before them, so a card shows that letter too. */
export const startsWithAttachedSign = (ending: string) => /^[ਁ-ਃ਼-ੑੰੱ]/.test(ending);
