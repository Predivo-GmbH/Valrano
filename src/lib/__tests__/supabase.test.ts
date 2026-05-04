describe('Supabase client', () => {
  it('exports a supabase client', async () => {
    const { supabase } = await import('@/lib/supabase')
    expect(supabase).toBeDefined()
    expect(supabase.from).toBeDefined()
    expect(supabase.auth).toBeDefined()
  })
})
