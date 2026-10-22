/*
DOC NAME: FaqReorderClient.tsx
LOCATION: /src/app/[locale]/(admin)/admin/content/FaqReorderClient.tsx
SCOPE: Client-side FAQ reorder (drag/drop) wrapper that submits ordered ids to a server action.
STATUS: UNLOCKED (lock after verified)
*/

"use client";

import * as React from "react";

type Item = {
	id: string;
	label: string;
};

type Props = {
	items: Item[];
	locale: string;
	submitLabel: string;
	dragHint: string;
	action: (formData: FormData) => void;
};

export default function FaqReorderClient({ items, locale, submitLabel, dragHint, action }: Props) {
	const [order, setOrder] = React.useState<Item[]>(items);
	const draggingIdRef = React.useRef<string | null>(null);

	React.useEffect(() => {
		setOrder(items);
	}, [items]);

	const onDragStart = (id: string) => () => {
		draggingIdRef.current = id;
	};

	const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
		e.preventDefault();
	};

	const onDrop = (overId: string) => () => {
		const draggingId = draggingIdRef.current;
		draggingIdRef.current = null;
		if (!draggingId || draggingId === overId) return;

		setOrder((prev) => {
			const next = [...prev];
			const from = next.findIndex((x) => x.id === draggingId);
			const to = next.findIndex((x) => x.id === overId);
			if (from < 0 || to < 0) return prev;

			const [moved] = next.splice(from, 1);
			next.splice(to, 0, moved);
			return next;
		});
	};

	const serialized = order.map((x) => x.id).join(",");

	return (
		<form action={action} className="stack">
			<input type="hidden" name="locale" value={locale} />
			<input type="hidden" name="order_csv" value={serialized} />

			<p className="text-sm text-muted" style={{ margin: 0 }}>
				{dragHint}
			</p>

			<div className="stack">
				{order.map((it) => (
					<div
						key={it.id}
						draggable
						onDragStart={onDragStart(it.id)}
						onDragOver={onDragOver}
						onDrop={onDrop(it.id)}
						className="surface-soft"
						style={{ padding: "var(--space-3)", borderRadius: "var(--radius-lg)" }}
					>
						<p className="text-sm text-bold" style={{ margin: 0 }}>
							{it.label}
						</p>
					</div>
				))}
			</div>

			<div style={{ display: "flex", justifyContent: "flex-end" }}>
				<button type="submit" className="button button-secondary">
					{submitLabel}
				</button>
			</div>
		</form>
	);
}
