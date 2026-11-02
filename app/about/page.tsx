import InfoPage from "@/app/components/info-page";

export default function AboutPage() {
  return (
    <InfoPage
      eyebrow="ABOUT G2 PRINTHUB"
      title="Prints made personal."
      introduction="G2 PrintHub helps turn your ideas into custom prints for everyday use, businesses, gifts, and special moments."
      sections={[
        {
          title: "What we do",
          paragraphs: [
            "Explore a selection of print products, including cards and other customizable items. Choose a product and share the details needed to make it yours.",
            "We aim to make finding and ordering personalized prints simple, with product information and order details available throughout the shopping experience.",
          ],
        },
        {
          title: "Our approach",
          paragraphs: [
            "Every order starts with your idea. We focus on making the process clear and helping you find a print that fits what you have in mind.",
            "Browse the products available on G2 PrintHub to see current options and details.",
          ],
        },
      ]}
    />
  );
}