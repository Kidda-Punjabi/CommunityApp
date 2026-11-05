import type { WeekItem } from "./week-cards";

/**
 * Week 2's flashcards are single words and fill-the-gap cards, so its sentences come from
 * the Week 2 answer sheet instead. Please keep these checked against the slides.
 */
const sentence = (id: string, e: string, g: string, r: string): WeekItem => ({ id, kind: "sentence", e, g, r });

export const WEEK_EXTRA_SENTENCES: Record<number, WeekItem[]> = {
  2: [
    sentence("wk2-01", "She eats roti", "ਉਹ ਰੋਟੀ ਖਾਂਦੀ ਹੈ", "Oh roti khaandi hai"),
    sentence("wk2-02", "We go to school", "ਅਸੀਂ ਸਕੂਲ ਜਾਂਦੇ ਹਾਂ", "Asi school jaande haa"),
    sentence("wk2-03", "They clean the house", "ਉਹ ਘਰ ਸਾਫ਼ ਕਰਦੇ ਹਨ", "Oh ghar saaf karde han"),
    sentence("wk2-04", "I read a book", "ਮੈਂ ਕਿਤਾਬ ਪੜ੍ਹਦਾ ਹਾਂ", "Mai kitaab parhda haa"),
    sentence("wk2-05", "She writes a book", "ਉਹ ਕਿਤਾਬ ਲਿਖਦੀ ਹੈ", "Oh kitaab likhdi hai"),
    sentence("wk2-06", "You open the door", "ਤੁਸੀਂ ਦਰਵਾਜ਼ਾ ਖੋਲ੍ਹਦੇ ਹੋ", "Tusi darvaaza kholde ho"),
    sentence("wk2-07", "I listen to a song", "ਮੈਂ ਗਾਣਾ ਸੁਣਦਾ ਹਾਂ", "Mai gaana sunda haa"),
    sentence("wk2-08", "We finish the work", "ਅਸੀਂ ਕੰਮ ਮੁਕਾਂਦੇ ਹਾਂ", "Asi kam mukaande haa"),
    sentence("wk2-09", "I drive the car", "ਮੈਂ ਗੱਡੀ ਚਲਾਂਦਾ ਹਾਂ", "Mai gaddi chalaanda haa"),
    sentence("wk2-10", "She washes the clothes", "ਉਹ ਕੱਪੜੇ ਧੋਂਦੀ ਹੈ", "Oh kapre dhondi hai"),
    sentence("wk2-11", "He reads", "ਉਹ ਪੜ੍ਹਦਾ ਹੈ", "Oh parhda hai"),
    sentence("wk2-12", "We play", "ਅਸੀਂ ਖੇਡਦੇ ਹਾਂ", "Asi khedde haa"),
    sentence("wk2-13", "You sit", "ਤੁਸੀਂ ਬੈਠਦੇ ਹੋ", "Tusi baithde ho"),
    sentence("wk2-14", "I think", "ਮੈਂ ਸੋਚਦਾ ਹਾਂ", "Mai sochda haa"),
    sentence("wk2-15", "They use", "ਉਹ ਵਰਤਦੇ ਹਨ", "Oh varatde han"),
    sentence("wk2-16", "I ask", "ਮੈਂ ਪੁੱਛਦਾ ਹਾਂ", "Mai puchda haa"),
  ],
};

export function weekExtraById(id: string) {
  return Object.values(WEEK_EXTRA_SENTENCES).flat().find((item) => item.id === id) ?? null;
}
