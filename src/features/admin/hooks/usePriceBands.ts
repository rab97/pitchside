import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { findOverlappingBand } from '../utils/bandOverlap'
import { BandOverlapError, messageForBandOverlap } from '../utils/bandMessages'
import type { Band } from '../utils/daySegments'

type BandRow = {
  id: string
  weekday: number
  starts_min: number
  ends_min: number
  price_cents: number
}

export type SaveBandInput = {
  id?: string
  weekdays: number[]
  startsMin: number
  endsMin: number
  priceCents: number
}

/**
 * A pitch's price bands, and the two writes the timeline offers.
 *
 * A band is one idea in the form — one set of hours, one price, ticked
 * across however many weekdays — and several rows underneath, because
 * `price_bands` stores one row per weekday with no column of its own tying
 * those rows together. `saveBand` reconstructs the group implicitly: for an
 * edit (`input.id` set), it finds the band that id names in the bands
 * already loaded, then treats every other band with the same hours and
 * price as part of the same group. It deletes that whole group first and
 * inserts the new set of rows second, in that order, so the
 * `price_bands_no_overlap` exclusion constraint never fires against the
 * very rows being replaced. For a new band there is no group to delete —
 * it only inserts.
 *
 * That multi-row write is not atomic through PostgREST: a failure partway
 * through an edit can leave the week half-written. The constraint still
 * guarantees no overlap exists, so the failure mode is a missing band,
 * which the timeline already draws as closed rather than a wrong price.
 * This hook does not paper over that: on success or on failure alike it
 * invalidates the query, so the screen always ends up showing what is
 * actually stored, and lets the caller turn a thrown error into
 * `messageForBandWrite(error)`.
 *
 * Deleting the group before inserting is right against the exclusion
 * constraint, but wrong against a manager: if the insert then collides with
 * a *different* band, the original group is already gone and those weekdays
 * are unbookable until someone notices. `findOverlappingBand` runs first,
 * against the bands already loaded here, so a real collision is refused
 * before anything is deleted — the database constraint stays as the
 * backstop for whatever slips past this (a concurrent edit, mainly), not a
 * replacement for it.
 */
export function usePriceBands(fieldId: string | null) {
  const facility = useFacility()
  const qc = useQueryClient()
  const queryKey = ['price-bands', fieldId]

  const { data, isPending, error } = useQuery({
    queryKey,
    enabled: fieldId != null,
    queryFn: async (): Promise<Band[]> => {
      const { data, error } = await supabase
        .from('price_bands')
        .select('id, weekday, starts_min, ends_min, price_cents')
        .eq('field_id', fieldId as string)
        .order('weekday')
        .order('starts_min')
      if (error) throw error
      return (data as BandRow[]).map((r) => ({
        id: r.id,
        weekday: r.weekday,
        startsMin: r.starts_min,
        endsMin: r.ends_min,
        priceCents: r.price_cents,
      }))
    },
  })

  const bands = data ?? []

  function invalidate() {
    return qc.invalidateQueries({ queryKey })
  }

  const saveMutation = useMutation({
    mutationFn: async (input: SaveBandInput) => {
      let groupIds: string[] = []
      if (input.id) {
        const target = bands.find((b) => b.id === input.id)
        groupIds = target
          ? bands
              .filter((b) =>
                b.startsMin === target.startsMin &&
                b.endsMin === target.endsMin &&
                b.priceCents === target.priceCents)
              .map((b) => b.id)
          : [input.id]
      }

      const conflict = findOverlappingBand(bands, input.weekdays, input.startsMin, input.endsMin, groupIds)
      if (conflict) throw new BandOverlapError(messageForBandOverlap(conflict))

      if (groupIds.length > 0) {
        const { data, error } = await supabase
          .from('price_bands').delete().in('id', groupIds).select('id')
        if (error || !data || data.length !== groupIds.length) {
          throw error ?? new Error('L’eliminazione non ha rimosso tutte le fasce.')
        }
      }

      const rows = input.weekdays.map((weekday) => ({
        facility_id: facility.id,
        field_id: fieldId as string,
        weekday,
        starts_min: input.startsMin,
        ends_min: input.endsMin,
        price_cents: input.priceCents,
      }))
      // Zero rows back with no error is what an RLS policy that excludes the
      // insert looks like through PostgREST — not a thrown error, silence.
      const { data, error } = await supabase.from('price_bands').insert(rows).select('id')
      if (error || !data || data.length !== rows.length) {
        throw error ?? new Error('L’inserimento non ha scritto tutte le fasce.')
      }
      return data
    },
    onSettled: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: async (bandIds: string[]) => {
      const { data, error } = await supabase
        .from('price_bands').delete().in('id', bandIds).select('id')
      if (error || !data || data.length !== bandIds.length) {
        throw error ?? new Error('L’eliminazione non ha rimosso tutte le fasce.')
      }
      return data
    },
    onSettled: invalidate,
  })

  return {
    bands,
    isPending,
    error,
    saveBand: (input: SaveBandInput) => saveMutation.mutateAsync(input),
    deleteBand: (bandIds: string[]) => deleteMutation.mutateAsync(bandIds),
  }
}
