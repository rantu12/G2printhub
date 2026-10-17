import InfoPage from "@/app/components/info-page";

export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="YOUR INFORMATION"
      title="Privacy Policy"
      introduction="This page explains, in general terms, how information provided through PrintHub may be used when you browse or place an order."
      sections={[
        {
          title: "Information you provide",
          paragraphs: [
            "Depending on how you use the site, this may include account and contact details, delivery information, order details, messages to us, and artwork or other content you submit for printing.",
          ],
        },
        {
          title: "How information is used",
          paragraphs: [
            "Information may be used to operate your account, process and deliver orders, respond to questions, and maintain and improve the site and its services.",
          ],
        },
        {
          title: "Service providers and storage",
          paragraphs: [
            "Information may be shared with service providers when needed to operate the site or fulfill an order, such as hosting, delivery, or payment providers where applicable.",
            "PDF passwords submitted with an uploaded protected document are encrypted at rest and made available to authorized order staff when needed to process that order.",
            "We use reasonable measures to protect information and keep it only as needed for the purposes described or as required by law. No method of online transmission or storage can be guaranteed to be completely secure.",
          ],
        },
        {
          title: "Your choices",
          paragraphs: [
            "You may contact PrintHub to ask about or request a correction to information associated with your account or order. Please include enough information for us to identify the relevant account or order. Requests are handled subject to applicable legal and operational requirements.",
          ],
        },
      ]}
    />
  );
}