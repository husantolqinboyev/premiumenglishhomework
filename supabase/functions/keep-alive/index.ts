import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RENDER_URL = "https://premiumenglishhomework.onrender.com"

serve(async (req) => {
  try {
    const response = await fetch(RENDER_URL)
    const status = response.status
    
    console.log(`[${new Date().toISOString()}] Pinged: ${RENDER_URL}. Status: ${status}`)
    
    return new Response(
      JSON.stringify({ 
        ok: true,
        message: `Uyg'otildi: ${status}`,
        time: new Date().toISOString()
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error(`Xatolik: ${error.message}`)
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
