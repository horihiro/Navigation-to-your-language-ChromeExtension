export const targetUrlPatterns = [
  /(?<=^https?:\/\/learn\.microsoft\.com)\/[a-z]{2,3}(?:-[a-z]{4})?-[a-z]{2}(?=\/|$)/,
  /(?<=^https?:\/\/docs\.aws\.amazon\.com)\/[a-z]{2}_[a-z]{2}(?=\/|$)/,
  /(?<=^https?:\/\/cloud\.google\.com\/.*hl=)[a-z]{2}(?=&|$)/,
  /(?<=^https?:\/\/docs\.github\.com)\/[a-z]{2}(?=\/|$)/
];

export const contextMenus = [{
  id: 'open_default_locale',
  title: 'Open default locale page',
}, {
  id: 'copy_url_without_locale',
  title: 'Copy URL without locale',
}, {
  id: 'add_exlusion_url_pattern',
  title: 'Add exclution URL pattern',
}, {
  id: 'clear_exlusion_url_pattern_list',
  title: 'Clear exclution URL pattern list',
}];