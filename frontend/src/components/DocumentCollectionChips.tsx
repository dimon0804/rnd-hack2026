import type { CollectionItem } from "../api/documents";

type Props = {
  collectionIds: string[] | undefined;
  collections: CollectionItem[];
  className?: string;
  emptyLabel?: string;
};

export function DocumentCollectionChips({
  collectionIds,
  collections,
  className = "",
  emptyLabel = "без меток",
}: Props) {
  const label = (id: string) => collections.find((c) => c.id === id)?.name ?? id.slice(0, 8);
  const ids = collectionIds ?? [];

  return (
    <div className={`doc-coll-tags ${className}`.trim()} role="list" aria-label="Коллекции документа">
      {ids.length > 0 ? (
        ids.map((cid) => (
          <span key={cid} className="doc-coll-tag" title={label(cid)} role="listitem">
            {label(cid)}
          </span>
        ))
      ) : (
        <span className="doc-coll-none" role="listitem">
          {emptyLabel}
        </span>
      )}
    </div>
  );
}
