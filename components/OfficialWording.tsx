/** Agency title, body, and extra lines — always visible, never behind a tap. */
export default function OfficialWording({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="mt-s3 text-small leading-relaxed text-ink-2">
      <p className="font-semibold text-ink">{title}</p>
      {body && <p className="mt-s2 whitespace-pre-line">{body}</p>}
      {children}
    </div>
  );
}
