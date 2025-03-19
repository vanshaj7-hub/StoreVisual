// public/client.js
document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const vizElement = document.getElementById("visualization");
  const testButton = document.getElementById("testButton");
  const clearButton = document.getElementById("clearButton");
  const distanceDisplay = document.getElementById("distance");
  const imageContainer = document.getElementById("imageContainer");

  let coordinates = [];
  let totalDistance = 0;
  let imageHistory = [];
  const vizWidth = vizElement.offsetWidth;
  const vizHeight = vizElement.offsetHeight;

  // Calculate center point
  const centerX = vizWidth / 2;
  const centerZ = vizHeight / 2;

  // Map to store image data keyed by timestamp
  const imagePointMap = new Map();

  // Add ripple effect to buttons
  function createRipple(event) {
    const button = event.currentTarget;

    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${
      event.clientX - button.getBoundingClientRect().left - radius
    }px`;
    circle.style.top = `${
      event.clientY - button.getBoundingClientRect().top - radius
    }px`;
    circle.classList.add("ripple");

    const ripple = button.getElementsByClassName("ripple")[0];

    if (ripple) {
      ripple.remove();
    }

    button.appendChild(circle);
  }

 // testButton.addEventListener("mousedown", createRipple);
  clearButton.addEventListener("mousedown", createRipple);

  // Receive initial history
  socket.on("coordinate-history", (history) => {
    console.log("Received coordinate history:", history);
    coordinates = history;

    // Update distance if there are coordinates
    if (history.length > 0) {
      const lastCoord = history[history.length - 1];
      totalDistance = lastCoord.distance;
      updateDistanceDisplay(lastCoord);
    }

    renderAllCoordinates();
  });

  // Receive image history
  socket.on("image-history", (history) => {
    console.log("Received image history:", history);
    imageHistory = history;

    // Update image point map
    updateImagePointMap();

    renderAllImages();
  });

  // Receive new coordinate
  socket.on("new-coordinate", (data) => {
    console.log("New coordinate received:", data);
    coordinates.push(data);
    totalDistance = data.distance;
    updateDistanceDisplay(data);
    renderCoordinate(data);
  });

  // Receive new image
  socket.on("new-image", (data) => {
    console.log("New image received:", data);

    // Add to beginning of array so newest is first
    imageHistory.unshift(data);

    // Update image point map
    updateImagePointMap();

    renderAllImages();
  });

  // Coordinates cleared
  socket.on("coordinates-cleared", () => {
    console.log("Coordinates cleared");
    coordinates = [];
    totalDistance = 0;
    updateDistanceDisplay({ distance: 0 });
    vizElement.innerHTML = "";
    imagePointMap.clear();
  });

  // Images cleared
  socket.on("images-cleared", () => {
    console.log("Images cleared");
    imageHistory = [];
    imagePointMap.clear();
    renderAllImages();
  });

  // Test button to send sample coordinates
  testButton.addEventListener("click", () => {
    // Add button press animation
    testButton.classList.add("button-pressed");
    setTimeout(() => {
      testButton.classList.remove("button-pressed");
    }, 200);

    // Generate random coordinates between -100 and 100
    const x = Math.round((Math.random() * 200 - 100) * 100) / 100;
    const z = Math.round((Math.random() * 200 - 100) * 100) / 100;

    // Increase total distance by a small random amount
    totalDistance += Math.random() * 0.1;

    // Randomly include a photo capture (1) or not (0)
    const photoCapture = Math.random() > 0.5 ? 1 : 0;

    const timestamp = Date.now();

    fetch("/api/coordinates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          Number.parseFloat(totalDistance.toFixed(2)),
          x,
          z,
          photoCapture,
        ],
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Response:", data);

        // If photo was captured, send a test image URL
        if (photoCapture === 1) {
          // Use a random selection of image URLs for testing
          const testImages = [
            "https://firebasestorage.googleapis.com/v0/b/fieldapp-39256.appspot.com/o/ARTracker%2FGoogle_Poster_Phone.png?alt=media&token=cefac083-0fbe-4d83-916d-ac2e1cdd6326",
            "https://firebasestorage.googleapis.com/v0/b/fieldapp-39256.appspot.com/o/ARTracker%2FApple_Poster_Phone.png?alt=media&token=7f75f533-e249-44e3-8056-adca5caef03d",
            "https://firebasestorage.googleapis.com/v0/b/fieldapp-39256.appspot.com/o/ARTracker%2FSamsung_Display_Tablet.png?alt=media&token=12345678",
            "https://firebasestorage.googleapis.com/v0/b/fieldapp-39256.appspot.com/o/ARTracker%2FLGE_Banner_TV.png?alt=media&token=87654321",
          ];

          const imageUrl =
            testImages[Math.floor(Math.random() * testImages.length)];

          fetch("/api/image", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              imageUrl: imageUrl,
              metadata: {
                timestamp: timestamp,
              },
            }),
          })
            .then((response) => response.json())
            .then((data) => console.log("Image Response:", data))
            .catch((error) => console.error("Error sending image:", error));
        }
      })
      .catch((error) => console.error("Error:", error));
  });

  // Clear button
  clearButton.addEventListener("click", () => {
    // Add button press animation
    clearButton.classList.add("button-pressed");
    setTimeout(() => {
      clearButton.classList.remove("button-pressed");
    }, 200);

    fetch("/api/all", {
      method: "DELETE",
    })
      .then((response) => response.json())
      .then((data) => console.log("Response:", data))
      .catch((error) => console.error("Error:", error));
  });

  function updateImagePointMap() {
    // Clear the map first
    imagePointMap.clear();

    // Find matching coordinates for each image
    imageHistory.forEach((image) => {
      // Find the closest coordinate point by timestamp
      const closestCoord = findClosestCoordinateByTimestamp(image.timestamp);
      if (closestCoord) {
        imagePointMap.set(closestCoord.timestamp, {
          image: image,
          coordinate: closestCoord,
        });
      }
    });
  }

  function findClosestCoordinateByTimestamp(timestamp) {
    if (!coordinates.length) return null;

    // Find the coordinate with closest timestamp
    return coordinates.reduce((closest, coord) => {
      const currentDiff = Math.abs(coord.timestamp - timestamp);
      const closestDiff = Math.abs(closest.timestamp - timestamp);

      return currentDiff < closestDiff ? coord : closest;
    }, coordinates[0]);
  }

  function updateDistanceDisplay(coord) {
    // Animate the distance change
    const currentDistance = Number.parseFloat(
      distanceDisplay.textContent.replace("Distance: ", "")
    );
    const targetDistance = coord.distance;

    // Use requestAnimationFrame for smooth animation
    const animateDistance = (
      timestamp,
      startValue,
      endValue,
      startTime,
      duration = 500
    ) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const currentValue = startValue + (endValue - startValue) * progress;

      distanceDisplay.textContent = `Distance: ${currentValue.toFixed(2)}`;

      if (progress < 1) {
        requestAnimationFrame((time) =>
          animateDistance(time, startValue, endValue, startTime, duration)
        );
      }
    };

    requestAnimationFrame((timestamp) =>
      animateDistance(timestamp, currentDistance, targetDistance)
    );
  }

  function renderAllCoordinates() {
    // Clear all points
    vizElement.innerHTML = "";

    // Render all coordinates (points only, no lines)
    coordinates.forEach((coord, index) => {
      // Add a small delay for each point to create a sequential appearance
      setTimeout(() => {
        renderPoint(coord);
      }, index * 20); // 20ms delay between each point
    });
  }

  function renderCoordinate(coord) {
    renderPoint(coord);
  }

  function renderPoint(coord) {
    // Transform coordinates from -100,100 range to screen position
    // (0,0) at center of screen
    const screenX = centerX + (coord.x * centerX) / 100;
    const screenZ = centerZ + (coord.z * centerZ) / 100;

    // Create point
    const pointElement = document.createElement("div");
    pointElement.className = "point";
    pointElement.dataset.timestamp = coord.timestamp;

    // Set initial scale to 0 for animation
    pointElement.style.transform = "translate(-50%, -50%) scale(0)";

    // If photo was captured at this point, add the photo-captured class
    if (coord.photoCapture === 1) {
      pointElement.classList.add("photo-captured");

      // Add click event to show the corresponding image
      pointElement.addEventListener("click", () => {
        const pointData = imagePointMap.get(coord.timestamp);
        if (pointData) {
          // Find the corresponding image card
          const imageCard = document.querySelector(
            `.card[data-timestamp="${pointData.image.timestamp}"]`
          );
          if (imageCard) {
            // Remove active class from all cards
            document
              .querySelectorAll(".card")
              .forEach((card) => card.classList.remove("active"));

            // Add active class to this card
            imageCard.classList.add("active");

            // Scroll to the card
            imageCard.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      });
    }

    pointElement.style.left = `${screenX}px`;
    pointElement.style.top = `${screenZ}px`;
    vizElement.appendChild(pointElement);

    // Trigger animation after a small delay
    setTimeout(() => {
      pointElement.style.transform = "translate(-50%, -50%) scale(1)";
    }, 10);
  }

  function renderAllImages() {
    // Clear image container
    imageContainer.innerHTML = "";

    // Render images or empty state message
    if (imageHistory.length === 0) {
      const message = document.createElement("div");
      message.className = "no-images-message";
      message.textContent = "No images available";
      imageContainer.appendChild(message);
    } else {
      // Render actual images with staggered animation
      imageHistory.forEach((image, index) => {
        const card = createCardWithImage(image);
        // Set initial state for animation
        card.style.opacity = "0";
        card.style.transform = "translateY(20px)";
        imageContainer.appendChild(card);

        // Trigger animation with staggered delay
        setTimeout(() => {
          card.style.opacity = "1";
          card.style.transform = "translateY(0)";
        }, index * 100); // 100ms delay between each card
      });
    }
  }

  function parseImageUrl(url) {
    try {
      // Extract the filename from the URL
      // Looking for the pattern: .../ARTracker%2F{Brand}_{Visual}_{Product}.png
      const regex = /ARTracker%2F([^_]+)_([^_]+)_([^.]+)\.png/;
      const match = url.match(regex);

      if (match && match.length >= 4) {
        return {
          brand: match[1] || "Unknown",
          visual: match[2] || "Unknown",
          product: match[3] || "Unknown",
        };
      }

      // Fallback if regex doesn't match
      return {
        brand: "Unknown",
        visual: "Unknown",
        product: "Unknown",
      };
    } catch (error) {
      console.error("Error parsing image URL:", error);
      return {
        brand: "Unknown",
        visual: "Unknown",
        product: "Unknown",
      };
    }
  }

  async function fetchBannerMetadata() {
    try {
      const response = await fetch("/api/banner_data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: "https://example.com/sample-image.jpg",
          brand: "Nike",
          position: "Top Shelf",
          type: "Shoes",
        }),
      });

      const result = await response.json();
      if (response.ok) {
        return result.data; // Returns metadata from API
      } else {
        console.error("Error fetching metadata:", result.error);
        return null;
      }
    } catch (error) {
      console.error("Error fetching metadata:", error);
      return null;
    }
  }

  function createCardWithImage(imageData) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.timestamp = imageData.timestamp;
    card.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";

    const img = document.createElement("img");
    img.src = imageData.url;
    img.alt = "Captured Image";
    img.className = "card-image";
    img.loading = "lazy"; // Add lazy loading
    img.onerror = function () {
      console.error("Image failed to load:", imageData.url);
      this.src = "https://via.placeholder.com/120x120?text=Image+Load+Error";
    };

    const content = document.createElement("ul");
    content.className = "card-content";

    // Parse brand, visual and product from URL
    const parsedInfo = parseImageUrl(imageData.url);

    const brandItem = document.createElement("li");
    brandItem.className = "brand";
    brandItem.textContent = `Brand: ${parsedInfo.brand}`;
    content.appendChild(brandItem);

    const visualItem = document.createElement("li");
    visualItem.className = "visual";
    visualItem.textContent = `Visual Merchandise: ${parsedInfo.visual}`;
    content.appendChild(visualItem);

    const productItem = document.createElement("li");
    productItem.textContent = `Product: ${parsedInfo.product}`;
    content.appendChild(productItem);

    const measurementItem = document.createElement("li");
    measurementItem.textContent = `Measurement: ${parsedInfo.measurement}`;
    content.appendChild(measurementItem);

    // Add the AI Generated Summary text in italics
    const aiSummary = document.createElement("li");
    aiSummary.className = "ai-summary";
    aiSummary.innerHTML = `<i>AI Generated Summary: Brand - ${imageData.brand}, Position - ${imageData.position}, Type - ${imageData.type}</i>`;

    content.appendChild(aiSummary);

    card.appendChild(img);
    card.appendChild(content);

    // Add click event for the card
    card.addEventListener("click", () => {
      // Remove active class from all cards
      document
        .querySelectorAll(".card")
        .forEach((c) => c.classList.remove("active"));

      // Add active class to clicked card
      card.classList.add("active");

      // Add a subtle scale animation
      card.style.transform = "scale(1.05)";
      setTimeout(() => {
        card.style.transform = "";
      }, 300);
    });

    return card;
  }
});

// Planogram Toggle Functionality
document.addEventListener("DOMContentLoaded", function () {
  // Get the toggle button
  const planogramToggle = document.getElementById("planogramToggle");

  // Get the visualization element with the overlay
  const visualization = document.getElementById("visualization");

  // Variable to track toggle state
  let planogramVisible = false;

  // Add click event listener to the toggle button
  planogramToggle.addEventListener("click", function () {
    // Toggle the state
    planogramVisible = !planogramVisible;

    // Update button text and style
    if (planogramVisible) {
      planogramToggle.textContent = "Planogram: ON";
      planogramToggle.classList.add("active");

      // Make planogram visible by adjusting overlay opacity
      visualization.style.backgroundOpacity = "0.3";

      // Make sure the visualization has the overlay class
      if (!visualization.classList.contains("overlay")) {
        visualization.classList.add("overlay");
      }
    } else {
      planogramToggle.textContent = "Planogram: OFF";
      planogramToggle.classList.remove("active");

      // Hide planogram by removing overlay class
      visualization.classList.remove("overlay");
    }

    // Add ripple effect (if you want to keep the ripple effect from the original code)
    createRipple(event, planogramToggle);
  });

  // Initialize the toggle state (starting with planogram hidden)
  planogramVisible = false;
  planogramToggle.textContent = "Planogram: OFF";
  visualization.classList.remove("overlay");

  // Ripple effect function (assuming it's used in the original code)
  function createRipple(event, button) {
    const ripple = document.createElement("span");
    ripple.classList.add("ripple");

    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    const rect = button.getBoundingClientRect();

    ripple.style.width = ripple.style.height = `${diameter}px`;
    ripple.style.left = `${event.clientX - rect.left - radius}px`;
    ripple.style.top = `${event.clientY - rect.top - radius}px`;

    button.appendChild(ripple);

    ripple.addEventListener("animationend", () => {
      ripple.remove();
    });
  }
});
