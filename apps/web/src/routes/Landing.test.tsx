import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Landing } from './Landing.tsx';

const clerkState = {
  isSignedIn: false,
};

const openSignIn = vi.fn();
const openSignUp = vi.fn();

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: clerkState.isSignedIn }),
  useClerk: () => ({ openSignIn, openSignUp }),
}));

let container: HTMLDivElement;

function renderLanding() {
  container = document.createElement('div');
  document.body.appendChild(container);
  container.innerHTML = renderToStaticMarkup(<Landing />);
}

afterEach(() => {
  container?.remove();
  clerkState.isSignedIn = false;
  openSignIn.mockReset();
  openSignUp.mockReset();
});

describe('Landing', () => {
  it('renders the core value proposition in the hero', async () => {
    await renderLanding();

    expect(container.querySelector('h1')?.textContent).toContain(
      'See the evidence behind a changing underwriting picture',
    );
  });

  it('shows a signed-out simulation CTA', async () => {
    await renderLanding();

    expect(container.textContent).toContain('Start a Simulation');
  });

  it('shows the signed-in workbench CTA', async () => {
    clerkState.isSignedIn = true;
    await renderLanding();

    const workbenchLink = Array.from(container.querySelectorAll('a')).find(
      (link) => link.textContent?.includes('Open Workbench'),
    );
    expect(workbenchLink?.getAttribute('href')).toBe('/app');
  });

  it('does not render workspace controls or simulation identifiers', async () => {
    await renderLanding();

    const navigationText = Array.from(container.querySelectorAll('nav'))
      .map((nav) => nav.textContent)
      .join(' ');
    expect(navigationText).not.toMatch(/Overview|Consent|Applicant|Score|Behavior|Fairness|Audit/i);
    expect(container.textContent).not.toMatch(/applicantId|simulationId|fixture/);
  });

  it('renders the seven public sections in sequence', async () => {
    await renderLanding();

    const sectionIds = [
      'hero',
      'trust-strip',
      'how-it-works',
      'methodology',
      'safety',
      'marketing-cta',
      'footer',
    ];

    expect(sectionIds.every((id) => container.querySelector(`#${id}`))).toBe(
      true,
    );
  });

  it('avoids fake metrics, customer logos, and compliance badges', async () => {
    await renderLanding();

    expect(container.textContent).not.toMatch(/\d+%|Acme|SOC 2|ISO 27001/i);
  });

  it('uses one h1 followed by section h2 headings', async () => {
    await renderLanding();

    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelectorAll('h2').length).toBeGreaterThanOrEqual(5);
  });
});
