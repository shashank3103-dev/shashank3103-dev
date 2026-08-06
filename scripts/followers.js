const fs = require("fs");

const USERNAME = process.env.GITHUB_USERNAME;
const TOKEN = process.env.GITHUB_TOKEN;

async function getFollowers() {
  const res = await fetch(
    `https://api.github.com/users/${USERNAME}/followers?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  return await res.json();
}

(async () => {
  const followers = await getFollowers();

  let html = "<table><tr>";

  followers.forEach((user, index) => {
    html += `
    <td align="center">
      <a href="https://github.com/${user.login}">
        <img src="${user.avatar_url}" width="100px"/><br/>
        <b>${user.login}</b>
      </a>
    </td>
    `;

    if ((index + 1) % 8 === 0) html += "</tr><tr>";
  });

  html += "</tr></table>";

  const readme = fs.readFileSync("README.md", "utf8");

  const updated = readme.replace(
    /<!--START_SECTION:top-followers-->[\s\S]*<!--END_SECTION:top-followers-->/,
    `<!--START_SECTION:top-followers-->
${html}
<!--END_SECTION:top-followers-->`
  );

  fs.writeFileSync("README.md", updated);
})();
