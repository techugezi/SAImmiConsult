/*
DOC NAME: FaqLedger.tsx
LOCATION: /src/components/ui/FaqLedger/FaqLedger.tsx
SCOPE: FAQ list body rendered as Home-style “ledger” (animated open/close + rotating plus).
STATUS: UNLOCKED (lock after verified)
*/

"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import styles from "./FaqLedger.module.css";

type FaqLedgerItem = {
	id: string;
	question: string;
	answer: string;
};

type Props = {
	items: FaqLedgerItem[];
};

export default function FaqLedger({ items }: Props) {
	const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
	const [activeIdx, setActiveIdx] = useState<number | null>(safeItems.length > 0 ? 0 : null);

	if (safeItems.length === 0) return null;

	return (
		<div className={styles.ledgerList}>
			{safeItems.map((item, i) => {
				const isActive = activeIdx === i;

				return (
					<div
						key={item.id}
						className={`${styles.ledgerFaqItem} ${isActive ? styles.active : ""}`}
						role="button"
						tabIndex={0}
						onClick={() => setActiveIdx(isActive ? null : i)}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								setActiveIdx(isActive ? null : i);
							}
						}}
						aria-expanded={isActive}
					>
						<div className={styles.ledgerFaqHeader}>
							<span className={styles.ledgerIndex} aria-hidden="true">
								{String(i + 1).padStart(2, "0")}
							</span>

							<h3 className={styles.ledgerQuestion}>{item.question}</h3>

							<motion.span
								className={styles.ledgerPlus}
								animate={{ rotate: isActive ? 45 : 0 }}
								transition={{ duration: 0.18 }}
								aria-hidden="true"
							>
								+
							</motion.span>
						</div>

						<AnimatePresence initial={false}>
							{isActive ? (
								<motion.div
									className={styles.ledgerAnswerWrapper}
									initial={{ height: 0, opacity: 0 }}
									animate={{ height: "auto", opacity: 1 }}
									exit={{ height: 0, opacity: 0 }}
									transition={{ duration: 0.22, ease: "easeOut" }}
								>
									<p className={styles.ledgerAnswer}>{item.answer}</p>
								</motion.div>
							) : null}
						</AnimatePresence>
					</div>
				);
			})}
		</div>
	);
}
