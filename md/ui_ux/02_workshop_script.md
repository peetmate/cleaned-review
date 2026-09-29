# iCLEANED user-testing workshop: facilitator run sheet

**Format:** 3 h 15 min in total (a 2 h 30 min testing block plus a 45 min setup/debrief), for 8–25 participants in pairs, with one observer per 2–3 pairs.

**Audience:** researchers, NGO and extension staff, and students. They are not R users, their English varies, and they work on laptops over mixed-quality connections.

**Companion:** see `01_uiux_review.md` (UX-nn IDs), and use `03_feedback_form.md` to log issues.

## 1. Goals

1. Find out whether first-time users can build and run a baseline scenario and an intervention scenario, and compare them, using the app plus a 1-page task card. They should not need the PDF guide.
2. Identify where users enter wrong values without noticing: units, blanks, comma decimals, and defaults.
3. Test whether users read the Dashboard and Comparison charts correctly (absolute vs %, direction of change, units).
4. Collect usability (SUS) and usefulness ratings, plus concrete issues ready to file on GitHub.
5. **Non-goal:** validating the model's science. Treat all numbers as illustrative, and say so.

## 2. Before the day (checklist)

- [ ] **Accounts:** make sure every participant has an account before the session (UX-58). Test sign-up, Google sign-in and password reset on the Auth0 tenant (`dev-…`) with 3 test users. Check the tenant's email and login rate limits.
- [ ] **Server capacity:** runs are synchronous (UX-02). Get the host to confirm the number of R processes per app and raise it for the day. Do a load test: 10 people click Run at the same time and you time it.
- [ ] **Package build:** confirm the deployed `cleaned` build with `packageVersion("cleaned")` and the RemoteSha (UX-14).
- [ ] **Template scenario:** prepare `WS_Baseline` in the Shared Examples folder with valid seasons (sum 365), feeding at 100 %, a manure system chosen explicitly (not the default, UX-03), `manure_onfarm_fraction` > 0 (UX-04), non-zero rain and soil values (UX-10/11), and non-zero main-product removal (UX-09; with the default of 0, every chart is empty), land cover set to a real cover rather than the default "Dense forest" (UX-77), and a climate zone valid for the site (the list lacks Cool Temperate and Boreal, UX-76).
- [ ] **Fixes:** if time allows, apply the quick fixes: the xlsx unit cell for GHG (UX-17), the manure label (UX-04), and the manure default (UX-03).
- [ ] **Materials:** print the task cards (section 4), a 1-page glossary of units, and the known-issues slide (section 3).
- [ ] **Fallback:** keep an offline plan: screenshots or a screen recording of a full run, in case the server or the Wi-Fi fails.
- [ ] **Observers:** each observer gets the observation checklist (section 5) and the feedback forms. Assign pair IDs P01, P02 and so on.
- [ ] **Browsers:** ask participants to bring a laptop with Chrome or Edge. Phones are not supported (UX-48).

## 3. Known issues to announce up front (5 min, slide)

Keep this to one slide, in plain language:

1. **Numbers are for learning today, not for reports.** Several default values can make some results zero.
2. **Decimals:** type a point, not a comma, e.g. `1.5`, not `1,5`. The app may otherwise read `15` (UX-05).
3. **Don't leave number cells empty.** An empty cell becomes 0 (UX-05).
4. **Editing tables:** double-click a cell to edit it, then press Enter (UX-36). The Farm tab has 5 pages; use the arrows at the sides (UX-35).
5. **Saving is automatic.** There is no Save button. Red warning boxes do **not** stop the run, so fix them before running (UX-08).
6. **Before you click Run,** check that the Dashboard shows *your* scenario ticked (UX-16). Click Run **once** and wait, because the server is shared (UX-02).
7. If the screen goes grey, reload the page and select your scenario again. Your inputs are usually saved (UX-01, UX-39).
8. **Don't use the browser Back button.** It leaves the app (UX-39).
9. On comparison charts in "%" mode, the axis label still shows the original unit. Read the bars as % change (UX-07).
10. **Watch three defaults.** When you add a feed, set "Main product removal" (for example 0.9) and change "Land cover" from "Dense forest". When you add animals, choose each manure system rather than leaving "Pasture / range / paddock" (UX-09, UX-77, UX-03). If all your charts are empty, it is almost always main product removal = 0.
11. **Purchased manure, compost and bedding are asked in kg of nitrogen,** not kg of material. Leave them at 0 today unless you know the N amount (UX-65).
12. **Don't use "Share to pool"** today. Names collide between users (UX-19).

## 4. Tasks (participants, in pairs)

Give each pair a printed card with one task at a time. The facilitator only gives a hint after 2 minutes stuck, and the observer notes it as an "assist".

| # | Time | Task (as written on the card) | Success criteria | Watch for (UX-ID) |
|---|---|---|---|---|
| T1 | 10 min | Log in, answer the welcome questions, and find the GUIDE and Help. | Reaches the Scenario screen. Finds Help "?" and the GUIDE within 2 min. | Consent pop-ups; GUIDE opens a static PDF only (UX-27 refuted live: button is visible); hover-only help (UX-25) |
| T2 | 10 min | Make your own copy of the example scenario "WS_Baseline" and rename it "Baseline_<your initials>". | Copy exists in User Folder with the new name; no assist needed. | Shared Examples vs User Folder vs Pool radios; Clone vs Rename; name collisions (UX-20) |
| T3 | 15 min | In **Farm**, check the seasons add up to one year, and set annual rainfall to 1250.5 mm. | Seasons sum to 365; rainfall saved as 1250.5 (**facilitator checks the JSON or the field value after reload**). | Carousel pages missed (UX-35); comma decimal (UX-05); units |
| T4 | 15 min | In **Livestock**, change the number of lactating cows to 12. Each cow gives 8.5 litres of milk a day for a 300-day lactation; enter that. Tell us which manure system the cows use. | Herd = 12. Milk entered as annual kg per animal (≈ 2,600 kg/animal/year). Note whether they convert litres/day to kg/year unaided. Participant can find and name the manure system. | Label "Average annual milk production (kg/animal)" (`R/30_mod_scenario_init.R:57`); double-click editing (UX-36); 50-column scroll; "Number" label (UX-33); manure picker duplicates (UX-03) |
| T5 | 15 min | In **Feed Production**, add one new feed grown on the farm (e.g. Rhodes grass; note that Napier is not in the Tanzania DB, UX-79). | Feed added with a yield and a non-zero "main product removal". | Zero-removal default (UX-09); "Dense forest" land cover (UX-77); duplicate name trap (UX-06); orange columns reverting (UX-12) |
| T6 | 15 min | In **Livestock Feeding**, give the new feed 20 % of the diet for cows in each season, and keep the totals at 100 %. | Every season column sums to 100 %; red box gone. | Banner discoverability; negative %s (UX-15); many seasons |
| T7 | 10 min | Go to the **Dashboard**, run *your* two scenarios (Baseline and the one with the new feed), and tell us the GHG emissions. Include the unit. | Runs the correct scenarios; states a value **with a correct unit** (t CO₂e per ha; the axis wrongly says "ghg_emission"). | Wrong scenario preselected (UX-16); "ghg_emission" axis (UX-17); freeze during the run (UX-02) |
| T8 | 15 min | Compare the two scenarios with Baseline as the base. Did milk production and GHG go up or down, and by how much? | Correct direction and approximate % for both indicators. | Absolute unit on % axis (UX-07); category picker; base excluded from the chart |
| T9 | 10 min | Download your results and open them. Find the milk production number. | Opens the ZIP and finds the value in the xlsx. | ZIP contents, `.rds`, no CSV (UX-43); file names |
| T10 | 10 min (optional) | Using the guide, estimate the GHG effect if 30 % of 10,000 similar farms adopted the new feed. | Any reasonable method; note how they do it. | No extrapolation in the app (UX-21) |

**Timing:** tasks T1–T9 take ~115 min. With T10, a break, the intro and the debrief, the whole session is ~3 h 15 min. If time is short, drop T10 and merge T3 into T4.

## 5. Observation checklist (one per pair per task)

Use a tick or a short note, and record the time in minutes.

- [ ] **Completed**: unassisted, assisted, or failed
- [ ] **Time on task**
- [ ] **First click** correct? If not, what did they click?
- [ ] **Hesitation** over 20 s. Where?
- [ ] **Label or unit misread.** Quote the label.
- [ ] **Wrong value entered without noticing** (comma, blank, wrong unit). Record the value typed.
- [ ] **Did not see a red warning box**, or ignored it
- [ ] **Lost work or grey screen.** Note the time and the action just before.
- [ ] **Used the guide PDF or Help?** Which section, and did it help?
- [ ] **Misread a chart**: direction, unit, or % vs absolute
- [ ] **Connection issue** (slow, spinner over 30 s, disconnect)
- [ ] **Language difficulty.** Which word or phrase?
- [ ] **Emotional signal**: frustration, confusion, delight, "aha"
- [ ] **Quote** worth keeping (verbatim)

Log every issue on `03_feedback_form.md` right away, with pair ID, task and screen.

## 6. Think-aloud prompts (neutral; don't lead)

- "What are you looking for right now?"
- "What do you expect will happen when you click that?"
- "What does this number or label mean to you?"
- "How sure are you that this value was saved? What makes you think so?"
- "You paused there. What were you thinking?"
- "If you were alone, what would you do next?"
- "In your own words, what does this chart tell you?"
- "Is this the result you expected? Why or why not?"
- **Avoid:** "Is that confusing?", "Did you see the button?", and explaining the UI before they have tried it.

## 7. Post-session questionnaire (10 min, paper or form)

### 7a. System Usability Scale (SUS)
Rate each statement from 1 (strongly disagree) to 5 (strongly agree).

1. I think that I would like to use iCLEANED frequently.
2. I found iCLEANED unnecessarily complex.
3. I thought iCLEANED was easy to use.
4. I think that I would need the support of a technical person to be able to use iCLEANED.
5. I found the various functions in iCLEANED were well integrated.
6. I thought there was too much inconsistency in iCLEANED.
7. I would imagine that most people would learn to use iCLEANED very quickly.
8. I found iCLEANED very cumbersome to use.
9. I felt very confident using iCLEANED.
10. I needed to learn a lot of things before I could get going with iCLEANED.

**Scoring:**
- Odd items score (response − 1).
- Even items score (5 − response).
- Sum the ten item scores and multiply by 2.5, giving a score from 0 to 100. A score around 68 is average.

### 7b. App-specific questions

1. **Units:** how confident are you that the values you entered were in the units the app expected? (1 = not at all, 5 = fully confident)
2. **Results:** in your own words, what did the comparison chart tell you about your intervention? Was the direction (increase or decrease) clear? (free text + 1–5)
3. **Help:** when you were stuck, where did you look first: the "?" tooltips, the GUIDE PDF, your partner, or the facilitator? What was missing? (multiple choice + free text)
4. **Connection:** did the app feel too slow or freeze at any point? (yes/no; which step)
5. **Use:** would you use iCLEANED for your own work? What single change would make that more likely? And which language would you prefer the app in? (1–5 + free text)

## 8. Debrief (15 min, whole group)

- Ask each pair for the top 3 pain points, and put them on sticky notes on the wall under Farm / Livestock / Feed / Feeding / Dashboard / Compare / Other.
- Dot-vote on severity.
- The facilitator maps each note to an existing UX-ID or a new issue in `03_feedback_form.md`.
- Thank participants. Tell them what will happen to their feedback: it will be filed on GitHub, with no personal data.

## 9. After the session

- Compute the SUS mean and SD, and the task success rates (unassisted, assisted, failed) and median times.
- Deduplicate the feedback forms, and map them to UX-IDs and to the GitHub forms (see `03_feedback_form.md`).
- Delete the test scenarios and the throwaway accounts. Participants' onboarding answers are stored in `DATA_DIR/Onboarding/onboarding.csv`; handle that file according to your consent statement.
