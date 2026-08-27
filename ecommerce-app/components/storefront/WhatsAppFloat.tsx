import { getSiteSettings, whatsappLink } from "@/lib/site-settings";

/**
 * Floating click-to-chat button.
 *
 * Renders nothing until a WhatsApp business number is configured, so an
 * un-onboarded store does not ship a button that opens a dead chat.
 */
export async function WhatsAppFloat() {
  const settings = await getSiteSettings();
  const href = whatsappLink(settings);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="group fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_7px_24px_rgba(0,0,0,0.24)] transition-all duration-300 hover:-translate-y-1 hover:rotate-6 hover:scale-110 hover:shadow-[0_12px_30px_rgba(37,211,102,0.38)] sm:bottom-4 sm:right-4"
    >
      <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-0 group-hover:animate-ping group-hover:opacity-25" />
      <span className="relative flex items-center justify-center">
        <svg viewBox="0 0 32 32" aria-hidden="true" className="h-6 w-6 fill-current">
          <path d="M16.04 3A12.9 12.9 0 0 0 5.1 22.75L3.4 29l6.4-1.68A12.98 12.98 0 1 0 16.04 3Zm0 23.78c-2.06 0-4.08-.56-5.83-1.62l-.42-.25-3.8 1 1.02-3.7-.27-.43A10.72 10.72 0 1 1 16.04 26.78Zm5.9-8.03c-.32-.16-1.92-.95-2.22-1.06-.3-.11-.51-.16-.73.16-.21.32-.83 1.06-1.02 1.27-.19.22-.38.24-.7.08-.33-.16-1.37-.5-2.61-1.61a9.8 9.8 0 0 1-1.81-2.25c-.19-.32-.02-.5.14-.66.15-.15.33-.38.49-.57.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.73-1.76-1-2.41-.26-.64-.53-.55-.73-.56h-.62c-.22 0-.57.08-.87.4-.3.32-1.14 1.11-1.14 2.71s1.17 3.15 1.33 3.36c.16.22 2.3 3.5 5.57 4.91.78.34 1.39.54 1.86.69.78.25 1.49.21 2.05.13.63-.09 1.92-.79 2.19-1.55.27-.76.27-1.41.19-1.55-.08-.13-.3-.21-.62-.37Z" />
        </svg>
      </span>
    </a>
  );
}
