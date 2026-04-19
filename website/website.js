const upload = document.getElementById("upload");
const gallery = document.querySelector(".images");

upload.addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = document.createElement("img");
    img.src = e.target.result;
    img.className = "gallery-img";
    gallery.appendChild(img);
  };
  reader.readAsDataURL(file);
});

function playGame() {
  alert("Тут будет запуск твоей игры 🎮");
}

const heroImg = document.getElementById("heroImg");
heroImg.addEventListener("click", () => {
  const url = prompt("Вставь ссылку на картинку:");
  if (url) heroImg.src = url;
});
