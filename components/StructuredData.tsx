/** JSON-LD structured data for richer search results. */
export function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LifeOS",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web, iOS, Android",
    description:
      "LifeOS is your personal operating system that connects your goals, finances, dreams, memories, projects, and future into one intelligent life dashboard.",
    offers: {
      "@type": "Offer",
      price: "18.00",
      priceCurrency: "USD",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "1284",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
