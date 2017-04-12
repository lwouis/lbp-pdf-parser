import { LbpPdfParser2Page } from './app.po';

describe('lbp-pdf-parser2 App', () => {
  let page: LbpPdfParser2Page;

  beforeEach(() => {
    page = new LbpPdfParser2Page();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('app works!');
  });
});
