type InfoPageSection = {
  title: string;
  paragraphs: string[];
};

type InfoPageProps = {
  eyebrow: string;
  title: string;
  introduction: string;
  sections: InfoPageSection[];
};

export default function InfoPage({
  eyebrow,
  title,
  introduction,
  sections,
}: InfoPageProps) {
  return (
    <main className="info-page">
      <div className="info-page-shell">
        <header className="info-page-header">
          <span className="info-page-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{introduction}</p>
        </header>

        <div className="info-page-content">
          {sections.map((section) => (
            <section className="info-page-section" key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
