/**
 * The three normalisations this dialog has to agree with the database on.
 *
 * `digitsOf` is what `useCreateMember` writes into `members.phone`, and what
 * `phoneKey` then keeps the last ten of. It used to be inlined twice — once
 * at the insert, once in the optimistic `MemberHit` that stands in for the row
 * that insert just wrote — and the two copies had to stay character for
 * character identical: if one ever learned to keep a leading `+`, the promoted
 * choice would carry a phone the database does not hold, and nothing in the
 * dialog would notice.
 *
 * `phoneKey` mirrors `public.phone_key` (0012_member_identity.sql:4-10): the
 * last ten digits, because an Italian mobile has ten and the manager writes
 * «333 111 22 33» where gotrue stores «393331112233». It is what the unique
 * index on `(facility_id, phone_key(phone))` is built over (0016:31), so it is
 * the only form in which two numbers can be asked whether they are the same
 * one, and `search_members` now normalises its own query side through that
 * same function (0020_member_search.sql). Client and database therefore agree
 * by construction: `slice(-10)` and `right(…, 10)` are the same rule, and
 * neither can drift without the other's tests noticing.
 *
 * Kept on this side even so, because the caller means the key and not the
 * keystrokes: what the dialog holds after a collision is the thing the index
 * refused. `+39 333 111 2233` collides with a row stored as «3331112233», and
 * the lookup that offers that row has to ask about the same ten digits.
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

export function phoneKey(input: string): string {
  return digitsOf(input).slice(-10)
}

export function nameKey(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}
