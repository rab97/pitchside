/**
 * The two normalisations this dialog has to agree with the database on.
 *
 * `digitsOf` is what `useCreateMember` writes into `members.phone`, and what
 * `phone_key()` then keeps the last ten of. It used to be inlined twice — once
 * at the insert, once in the optimistic `MemberHit` that stands in for the row
 * that insert just wrote — and the two copies had to stay character for
 * character identical: if one ever learned to keep a leading `+`, the promoted
 * choice would carry a phone the database does not hold, and nothing in the
 * dialog would notice.
 *
 * `nameKey` mirrors `public.name_key` (0020_member_search.sql): lower case,
 * accents dropped. It answers "is this name already in the book?" over rows
 * `search_members` has already returned, and comparing the raw strings there
 * would miss exactly the pair the question exists for — «Nicolò» typed as
 * «nicolo».
 */

export function digitsOf(input: string): string {
  return input.replace(/\D/g, '')
}

export function nameKey(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}
