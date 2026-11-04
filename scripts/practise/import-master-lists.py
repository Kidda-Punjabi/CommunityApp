#!/usr/bin/env python3
"""Rebuild src/lib/practise/master-lists.json from Kidda_Level_Master_Lists.xlsx.
Usage: python3 scripts/practise/import-master-lists.py path/to/workbook.xlsx
Ids hash the level, kind and text, so progress survives reordering rows."""
import hashlib, json, sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
def rows(n): return list(wb[n].iter_rows(values_only=True))[1:]
def s(v): return str(v).strip() if v is not None else ""

# The workbook groups many words by course week. Learners outside the course need real topics.
NAMED = {
  "Question words": "who;why;which;how many (countable);how much (uncountable);whose;from where;what time",
  "Describing words": "fun;easy;difficult;necessary / important;hard;bad;late;early;big;small;long / tall;short;thick / fat;thin;wide;tall / high;deep;clean;dirty;new;old;broken;strong;weak;different;sick;sudden / suddenly;fast;hot;carefully;slowly",
  "Connecting and position words": "and;but;because;so / therefore;then / after that;also / too;or;if;when;that / which;with;without;before;after;because of;not;from;in;on;for;there;this;here;outside;inside;down;next door;then;then (by that time);otherwise;in case;unless;maybe;my;your;his / her;their;own (my own / our own);our;more;a lot;please",
  "Time words": "now;morning;today;evening;evening (\u0a38\u0a3c\u0a3e\u0a2e\u0a40);time;yesterday;last night;night;weekend;next week;already;last minute;long time;daily;all day;hour;minute;half an hour;week",
  "Days and seasons": "Monday;Tuesday;Wednesday;Thursday;Friday;Saturday;Sunday;summer;winter;spring;autumn",
  "How often": "always;often;sometimes;rarely;never;twice a week;once a month;every other day",
  "People and family": "family;child;children;friend;teacher;man;girl;boy;mother;student;guests;manager;nobody;Son",
  "Places": "shop;shops;school;Gurdwara;room;kitchen;park;gym;garden;building;river;mountain;path;office;ticket;station;airport",
  "Getting around": "car;bus;by bus;by train;by plane;by car;on foot;by taxi",
  "Food and drink": "fruit;breakfast;dinner;lunch;dishes;Milk",
  "Weather": "rain;sunny;weather;it\u2019s raining;cloudy;windy;cold;snowing;foggy;thunder;humid;temperature",
  "Animals": "horses;cat;lion;elephant;horse;cow;buffalo;goat;monkey;mouse;peacock;parrot",
  "Colours": "black;red;blue;green;yellow;white;brown;pink;orange;purple",
  "Looks and clothes": "beard;hair;eyes;moustache;turban;chunni;glasses;height;short (height);curly;handsome / pretty;smiling;shirt;suit (f);clothes",
  "Work and study": "class;notes;maths;English;study;task;email;project;break;meeting;exam;deadline;job;computer;document;decision;plan;question;message;letter;book",
  "Everyday things": "door;song;news;music;window;picture;story;money;help;movies;table;bag;chair;film;toy;phone;thing;umbrella;advice;permission;need (\u0a1a\u0a3e\u0a39\u0a40\u0a26\u0a3e);need (\u0a32\u0a4b\u0a5c \u0a39\u0a48)",
}
LOOKUP = {w: c for c, ws in NAMED.items() for w in ws.split(";")}
WHOLE_WEEK = {"Intermediate Week 1": "Family", "Intermediate Week 3": "Daily routine", "Intermediate Week 5": "Around the house", "Intermediate Week 8": "Feelings and emotions", "Intermediate Week 9": "Food and cooking"}
def word_topic(topic, english):
    if "Week" not in topic and "guide" not in topic:
        return topic[0].upper() + topic[1:]
    if topic in WHOLE_WEEK: return WHOLE_WEEK[topic]
    if english in LOOKUP: return LOOKUP[english]
    if english.startswith("to "): return "Action words"
    if english[:1].isdigit(): return "Numbers"
    return "Everyday words"
items, seen = [], set()
def add(level, kind, topic, en, gu, ro, gender="", drafted=False):
    key = f"{level}|{kind}|{gu}|{ro}|{en}"
    if key in seen: return
    seen.add(key)
    it = dict(id=hashlib.sha1(key.encode()).hexdigest()[:12], l=level, k=kind, t=topic, e=en, g=gu, r=ro)
    if gender: it["x"] = gender
    if drafted: it["d"] = 1
    items.append(it)
for r in rows("Words"):
    add(r[0], "w", word_topic(s(r[1]), s(r[2])), s(r[2]), s(r[3]), s(r[4]), s(r[5]), "Drafted" in s(r[7]))
for r in rows("Sentences"):
    add(r[0], "s", s(r[1]), s(r[4]), s(r[2]), s(r[3]), "", "Drafted" in s(r[5]))
for r in rows("Sounds"):
    add(r[0], {"Sound map": "m", "Sound pair": "p", "Vowel": "v"}[s(r[5])], s(r[1]), s(r[4]), s(r[2]), s(r[3]))
for r in rows("Grammar"):
    if r[0] in (0, 9): continue
    add(r[0], "r", s(r[2]), s(r[1]), "", "")
json.dump(items, open("src/lib/practise/master-lists.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(items))
