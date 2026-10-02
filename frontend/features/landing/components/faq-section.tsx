import { Container } from "@/components/layout/container";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { FAQ } from "../content";
import { SectionHeading } from "./section-heading";

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 py-20 sm:py-24">
      <Container className="max-w-3xl">
        <SectionHeading id="faq-title" eyebrow="FAQ" title="Questions, answered" />
        <ScrollReveal>
          <Accordion type="single" collapsible className="rounded-xl border border-line bg-surface px-6 shadow-card sm:px-8">
            {FAQ.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollReveal>
      </Container>
    </section>
  );
}
