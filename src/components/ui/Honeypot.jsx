// Hidden bot trap for public forms. Positioned off-screen (not display:none -
// some bots skip display:none/visibility:hidden fields specifically) and
// pulled out of tab order, so a human filling the visible form in a browser
// never sees or reaches it, but a bot filling every field in the DOM does.
// The parent form checks this value before submitting: non-empty means the
// submission is dropped. Server-side, create_ticket() also checks its own
// honeypot parameter, since a client-side-only check is trivial to bypass by
// calling the API directly - see supabase/migrations.sql section 6.2.
export default function Honeypot({ value, onChange, name = 'company_website' }) {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
      <label htmlFor={name}>Leave this field empty</label>
      <input
        id={name}
        name={name}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={onChange}
      />
    </div>
  )
}
