import { resolve } from 'node:path';
import { generateLargeFixture } from '../../scripts/generate-large-fixture.mjs';

export default function setup() {
  generateLargeFixture(resolve(import.meta.dirname, '../fixtures/very-large.html'));
}
