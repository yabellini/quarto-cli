<% for (const item of items) { %>
<% partial('item-card.ejs.md', {listing, item}) %>
<% } %>