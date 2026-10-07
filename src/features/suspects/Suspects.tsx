import { ChapterCard } from "@/components/ChapterCard/ChapterCard";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { CharacterSelect } from "./CharacterSelect";
import styles from "./Suspects.module.css";

type Props = { dict: Dictionary["suspects"]; lang: Locale };

/**
 * THE USUAL SUSPECTS, right after the hero: the police line-up of
 * Jesús's four cats against a height chart, turned into a character
 * select (CharacterSelect, select.ts). Every cat refuses to be picked;
 * only Jesús, on one knee in the fifth slot, can be, and until he is the
 * page stops at the select (selectWall.ts). Every word is real text in the
 * server's HTML.
 *
 * It opens on its chapter card, THE CREW, the payoff of the hero's last
 * line ("Come and meet the crew"), over the wall's night lead-in.
 */
export function Suspects({ dict, lang }: Props) {
  return (
    <section id="suspects" className={styles.suspects} aria-labelledby="suspects-title" tabIndex={-1}>
      <ChapterCard id="suspects-title" chapter={dict.chapter} lang={lang} className={styles.chapter} />
      <CharacterSelect dict={dict} lang={lang} />
    </section>
  );
}
