import InfoPage from "@/app/components/info-page";

export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="PLEASE READ"
      title="Terms of Service"
      introduction="These terms describe the basic expectations for using PrintHub and placing an order through the site."
      sections={[
        {
          title: "Using the site",
          paragraphs: [
            "Please provide accurate account, contact, and delivery information, and use the site only for lawful purposes. Product details and availability may change.",
          ],
        },
        {
          title: "Orders",
          paragraphs: [
            "An order request is subject to product availability and confirmation. Review the product, order summary, and any instructions shown during checkout before submitting your order.",
            "If you need to correct an order detail, contact PrintHub as soon as possible and include your order information. Changes may not be possible once an order is being prepared.",
          ],
        },
        {
          title: "Artwork and submitted content",
          paragraphs: [
            "You are responsible for ensuring that any text, images, logos, or other content you submit is accurate and that you have permission to use it. Submitted content must not violate another person's rights or applicable law.",
          ],
        },
        {
          title: "Updates to these terms",
          paragraphs: [
            "We may update these terms as the site or its services change. The current version will be available on this page. Continued use of the site after an update means you accept the updated terms.",
          ],
        },
      ]}
    />
  );
}