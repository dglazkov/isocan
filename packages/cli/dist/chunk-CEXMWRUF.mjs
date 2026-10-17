import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  rebuildPrototypes,
  writeWire
} from "./chunk-QLMGWNLW.mjs";
import {
  COMPONENTS,
  INTENT_BY_ID,
  RECIPE_BY_ID,
  component,
  defaultIntent,
  presentElements,
  recipe,
  wireTitle
} from "./chunk-TERLGXWE.mjs";
import {
  envTextGenerator,
  stubTextGenerator
} from "./chunk-ODKP6MPE.mjs";
import {
  newGroupId
} from "./chunk-CVBHXI2X.mjs";

// packages/modules/wireframe/src/content/packs.ts
var PACKS = [
  {
    id: "generic",
    name: "Generic",
    about: "anything that fits no other pack \u2014 a general-purpose app of documents, projects and notes",
    noun: ["Item", "Items"],
    home: "Overview",
    titles: ["Spring update", "Project Alder", "Weekly review", "Onboarding plan", "Budget draft", "Team notes", "Launch checklist", "Field report", "Client brief", "Design review", "Roadmap", "Retro notes", "Q{#1-4} goals", "Supplier list", "Event plan", "Training guide", "Photo set", "Travel plan", "Reading list", "Idea board", "Open questions", "Kickoff notes"],
    subs: ["Edited by {name}", "{#2-14} files", "Shared with {#2-9} people", "Updated {ago}", "{#1-9} comments"],
    statuses: ["Active", "Draft", "In review", "Done", "Archived"],
    categories: ["Work", "Personal", "Shared", "Ideas", "Archive"],
    meta: ["{ago}", "{day}", "{date}"],
    amount: ["{#1-40} pages", "{#1-9}.{#0-9} MB"],
    columns: ["Name", "Details", "Status", "Updated", "Folder", "Owner", "Created", "Size"],
    metrics: [{ label: "Open", value: "{#8-40}", delta: "+{#1-6}" }, { label: "Due this week", value: "{#2-9}" }, { label: "Done", value: "{#60-95}%", delta: "+{#2-9}%" }, { label: "Shared", value: "{#3-30}" }],
    fields: [["Name", "Spring update"], ["Owner", "{name}"], ["Due", "{date}"], ["Folder", "Work"], ["Tags", "Planning, Q{#1-4}"], ["Notes", "Draft for review"]],
    details: [["Owner", "{name}"], ["Created", "{date}"], ["Folder", "Work"], ["Size", "{#1-9}.{#0-9} MB"]],
    lines: ["A short summary of what this is and who it is for.", "Updated after the last review, with the open questions answered.", "Everything the team needs before the next milestone.", "Two sections still need an owner.", "Linked from the weekly review.", "The next step is a quick read-through."],
    remarks: ["Looks good to me.", "Can we move this to next week?", "Added the missing numbers.", "Left two notes in the draft.", "Who owns this one?", "Done \u2014 thanks!"],
    roles: ["Project lead", "Member since {date}"],
    profile: [["Items", "{#12-240}"], ["Shared", "{#3-40}"], ["Teams", "{#1-6}"]],
    pitch: ["Everything in one place", "Keep your work organised and share it in a tap."],
    empty: ["Nothing here yet", "Items you add will show up here."],
    success: ["All set", "Your changes are saved."],
    motifs: ["image", "checklist", "briefcase", "calendar", "chat", "star"]
  },
  {
    id: "deliveries",
    name: "Deliveries and logistics",
    about: "couriers, parcels, drivers, delivery routes, shipping and tracking",
    noun: ["Delivery", "Deliveries"],
    home: "Today's route",
    titles: ["Parcel {#4400-4999}", "Parcel {#4400-4999}", "Envelope {#1100-1999}", "Box {#210-299}", "Pallet {A-F}{#10-99}", "Return {#300-399}", "Crate {#50-99}", "Flowers for {first}", "Grocery drop", "Pharmacy bag", "Bike parts", "Office supplies", "Tile samples", "Birthday cake", "Laptop return", "Plant pots \xD7{#2-6}", "Paint tins", "Spare tyres", "Wine case", "Print proofs", "Camera kit", "Rug, rolled"],
    subs: ["{#1-6} items", "{#1-6} items \xB7 {#1-12} kg", "Signature needed", "Leave at door", "Stop {#1-24} of 24"],
    statuses: ["Out for delivery", "Awaiting scan", "Delivered", "Delayed", "At depot", "Picked up"],
    categories: ["Standard", "Express", "Same day", "Return", "Oversize"],
    meta: ["{time}", "ETA {time}", "{#1-9}.{#0-9} km"],
    amount: ["{#1-12}.{#0-9} kg"],
    columns: ["Parcel", "Items", "Status", "ETA", "Service", "Driver", "Date", "Weight"],
    metrics: [{ label: "Today", value: "{#12-40}", delta: "+{#2-6}" }, { label: "Late", value: "{#1-5}", delta: "\u2212{#1-2}", down: true }, { label: "Delivered", value: "{#60-98}%" }, { label: "Stops left", value: "{#3-18}" }, { label: "Km driven", value: "{#20-140}" }],
    fields: [["Recipient", "{name}"], ["Parcel ID", "{#4400-4999}"], ["Weight", "{#1-12}.{#0-9} kg"], ["Service", "Express"], ["Delivery window", "{time}\u2013{time}"], ["Instructions", "Leave with neighbour"]],
    details: [["Recipient", "{name}"], ["Service", "Express"], ["Weight", "{#1-12}.{#0-9} kg"], ["Window", "{time}\u2013{time}"]],
    lines: ["Scanned at the north depot and loaded on van {#1-9}.", "The recipient asked for a call on arrival.", "Two attempts left before it returns to the depot.", "Fragile \u2014 keep upright.", "Proof of delivery is a photo at the door.", "Rerouted after the first stop was closed."],
    remarks: ["Left it with the concierge.", "Customer not home \u2014 card left.", "Van {#1-9} is running {#5-20} min late.", "Gate code updated.", "Signed by {first}.", "Scanned twice by mistake \u2014 fixed."],
    roles: ["Driver \xB7 Route {#1-30}", "Dispatcher \xB7 North depot"],
    profile: [["Deliveries", "{#300-2000}"], ["Rating", "4.{#6-9}"], ["On time", "{#88-99}%"]],
    pitch: ["Every parcel, one route", "Scan, sort and deliver without the paperwork."],
    empty: ["No deliveries yet", "Parcels you scan will show up here."],
    success: ["Delivered", "The parcel was signed for at {time}."],
    motifs: ["parcel", "truck", "box", "scan", "pin", "checklist"]
  },
  {
    id: "inventory",
    name: "Inventory and warehouse",
    about: "stock, warehouses, receiving goods, stock counts, suppliers and purchase orders",
    noun: ["Delivery", "Incoming"],
    home: "Receiving",
    titles: ["Delivery {#7100-7999}", "PO-{#2000-2999}", "Cable ties, 200 mm", "Shelf bracket {A-F}", "Pallet wrap", "Safety gloves (L)", "Bin labels", "Hex bolts M{#6-12}", "Cardboard 60\xD740", "Packing tape", "Hi-vis vest", "Floor tape, yellow", "Barcode rolls", "Steel shelving", "Hand truck", "Tote {#100-199}", "Returns batch {#10-99}", "Cycle count {A-F}", "Mixed SKU pallet", "Fuse kit", "Spare casters", "Label printer ribbon"],
    subs: ["Dock {#1-6}", "Bay {A-F}{#1-24}", "Alder Supply Co.", "Aisle {#1-18} \xB7 shelf {#1-6}", "{#2-9} lines outstanding", "PO-{#2000-2999}"],
    statuses: ["Outstanding", "Received", "Partial", "Checked", "Low stock", "Put away"],
    categories: ["Inbound", "Outbound", "Returns", "Consumables", "Fixtures"],
    meta: ["{#4-120} units", "{time}", "Dock {#1-6}"],
    amount: ["{#4-480} units", "${#12-900}.00"],
    columns: ["Item", "Location", "Status", "Qty", "Type", "Checked by", "Received", "Value"],
    metrics: [{ label: "Outstanding", value: "{#4-24}", delta: "\u2212{#1-5}", down: true }, { label: "Received today", value: "{#18-90}", delta: "+{#3-12}" }, { label: "Low stock", value: "{#2-9}" }, { label: "Accuracy", value: "9{#6-9}.{#0-9}%" }],
    fields: [["Delivery note", "DN-{#7100-7999}"], ["Supplier", "Alder Supply Co."], ["Quantity", "{#4-120}"], ["Location", "Bay {A-F}{#1-24}"], ["Condition", "Good"], ["Notes", "Two cartons dented"]],
    details: [["Supplier", "Alder Supply Co."], ["Location", "Bay {A-F}{#1-24}"], ["On hand", "{#4-480} units"], ["Reorder at", "{#10-60}"]],
    lines: ["Arrived on dock {#1-6} and waiting to be checked.", "{#1-9} lines are short against the purchase order.", "Count matches the delivery note.", "Put away before the evening shift.", "Two cartons arrived damaged and are set aside.", "Reorder point reached \u2014 a purchase order is drafted."],
    remarks: ["Counted twice, all good.", "Short by {#2-9} units.", "Moved to bay {A-F}{#1-24}.", "Supplier says the rest ships Friday.", "Labels reprinted.", "Scanner battery low on dock {#1-6}."],
    roles: ["Receiving \xB7 Dock {#1-6}", "Stock controller"],
    profile: [["Received", "{#200-1800}"], ["Counts", "{#20-90}"], ["Accuracy", "9{#6-9}%"]],
    pitch: ["Know what came in", "Scan deliveries at the dock and see what is still outstanding."],
    empty: ["Nothing outstanding", "Deliveries you scan will appear here."],
    success: ["Delivery received", "Every line is checked and put away."],
    motifs: ["box", "scan", "truck", "parcel", "checklist", "ladder"]
  },
  {
    id: "restaurant",
    name: "Restaurant and ordering",
    about: "restaurants, kitchens, food ordering, tables, menus and takeaway",
    noun: ["Order", "Orders"],
    home: "Tonight",
    titles: ["Table {#1-24}", "Order #{#100-999}", "Takeaway for {first}", "Margherita", "Mushroom risotto", "Fish tacos", "Caesar salad", "Lamb shoulder", "Veggie burger", "Tomato soup", "Chocolate tart", "Lemon sorbet", "Flat white", "House lemonade", "Chips, large", "Pad kra pao", "Dumplings \xD7{#6-12}", "Ramen, spicy", "Falafel wrap", "Garden salad", "Roast chicken", "Espresso"],
    subs: ["{#1-6} items \xB7 ${#12-90}", "{#2-8} guests", "Pickup {time}", "No onions", "Allergy: nuts"],
    statuses: ["New", "Preparing", "Ready", "Served", "Paid", "Waiting"],
    categories: ["Starters", "Mains", "Desserts", "Drinks", "Sides"],
    meta: ["{time}", "${#6-38}", "{#5-25} min"],
    amount: ["${#6-38}.{#00-99}"],
    columns: ["Order", "Details", "Status", "Time", "Course", "Server", "Date", "Total"],
    metrics: [{ label: "Covers", value: "{#40-160}", delta: "+{#4-20}" }, { label: "Waiting", value: "{#1-8}" }, { label: "Avg ticket", value: "${#18-45}" }, { label: "Prep time", value: "{#8-19} min", delta: "\u2212{#1-3}", down: true }],
    fields: [["Name", "{name}"], ["Guests", "{#2-8}"], ["Time", "{time}"], ["Table", "{#1-24}"], ["Phone", "+1 555 01{#10-99}"], ["Notes", "Window seat"]],
    details: [["Table", "{#1-24}"], ["Guests", "{#2-8}"], ["Server", "{name}"], ["Total", "${#40-240}"]],
    lines: ["Slow-cooked with garlic, lemon and thyme.", "Served with a side of seasonal greens.", "Our most ordered dish this month.", "Can be made vegan on request.", "Kitchen closes at {time}.", "Two courses left for this table."],
    remarks: ["Table {#1-24} would like the bill.", "Out of sorbet tonight.", "Extra napkins for {#2-8}.", "Fire the mains now.", "Birthday \u2014 bring a candle.", "Allergy noted: nuts."],
    roles: ["Server \xB7 Evening shift", "Head chef"],
    profile: [["Orders", "{#400-3000}"], ["Rating", "4.{#5-9}"], ["Shifts", "{#20-200}"]],
    pitch: ["Orders, straight to the kitchen", "Take orders at the table and see what is ready."],
    empty: ["No orders yet", "New orders will appear here as they come in."],
    success: ["Order sent", "The kitchen has it \u2014 about {#10-25} minutes."],
    motifs: ["bowl", "cup", "pan", "checklist", "star", "chat"]
  },
  {
    id: "recipes",
    name: "Recipes and cooking",
    about: "recipes, cooking at home, meal plans, ingredients and shopping lists",
    noun: ["Recipe", "Recipes"],
    home: "What's cooking",
    titles: ["One-pan lemon chicken", "Weeknight dal", "Green shakshuka", "Miso aubergine", "Roast squash soup", "Crispy tofu bowls", "Tomato galette", "Banana bread", "Herb omelette", "Pesto pasta", "Black bean tacos", "Chickpea curry", "Mushroom stroganoff", "Summer rolls", "Overnight oats", "Lentil salad", "Ginger fried rice", "Fish pie", "Apple crumble", "Flatbreads", "Spiced carrots", "Corn fritters"],
    subs: ["{#15-60} min \xB7 serves {#2-6}", "{#5-12} ingredients", "Vegetarian", "By {name}", "Saved {#40-900} times"],
    statuses: ["Saved", "Cooked", "Planned", "New", "Favourite"],
    categories: ["Breakfast", "Lunch", "Dinner", "Baking", "Quick"],
    meta: ["{#15-60} min", "\u2605 4.{#2-9}", "{#200-800} kcal"],
    amount: ["{#15-60} min"],
    columns: ["Recipe", "Details", "Status", "Time", "Meal", "Cook", "Added", "Prep"],
    metrics: [{ label: "Saved", value: "{#12-80}" }, { label: "Cooked this week", value: "{#2-7}", delta: "+{#1-3}" }, { label: "Avg time", value: "{#20-45} min" }, { label: "Shopping list", value: "{#4-18} items" }],
    fields: [["Title", "Weeknight dal"], ["Serves", "{#2-6}"], ["Prep time", "{#10-30} min"], ["Cook time", "{#15-50} min"], ["Tags", "Vegetarian, quick"], ["Notes", "Double the garlic"]],
    details: [["Serves", "{#2-6}"], ["Prep", "{#10-30} min"], ["Cook", "{#15-50} min"], ["Calories", "{#300-700} kcal"]],
    lines: ["Soften the onion in a little oil until golden.", "Add the spices and cook for a minute until fragrant.", "Simmer gently, stirring now and then.", "Season to taste and finish with lemon.", "Keeps for three days in the fridge.", "Serve with rice or warm flatbread."],
    remarks: ["Made this twice \u2014 so good.", "Added chilli, worked well.", "Needed more salt for us.", "Kids loved it.", "Swapped in spinach.", "Perfect for a Tuesday."],
    roles: ["Home cook", "Recipe developer"],
    profile: [["Recipes", "{#12-200}"], ["Followers", "{#80-9000}"], ["Cooked", "{#40-400}"]],
    pitch: ["Dinner, sorted", "Plan the week, cook from your phone, shop in one list."],
    empty: ["No recipes saved", "Tap the heart on any recipe to keep it here."],
    success: ["Added to your plan", "It's on the list for {day}."],
    motifs: ["pan", "bowl", "leaf", "cup", "checklist", "star"]
  },
  {
    id: "shop",
    name: "Shop and retail",
    about: "an online shop, products, a store catalogue, carts, checkout and orders",
    noun: ["Product", "Products"],
    home: "Shop",
    titles: ["Linen shirt", "Canvas tote", "Trail runner", "Wool beanie", "Ceramic mug", "Desk lamp", "Rain jacket", "Leather wallet", "Water bottle", "Knit scarf", "Denim jacket", "Cotton tee", "Travel pillow", "Weekender bag", "Oak side table", "Scented candle", "Wireless earbuds", "Yoga mat", "Plant stand", "Sunglasses", "Notebook set", "Throw blanket"],
    subs: ["{#2-8} colours", "Free shipping", "Only {#2-9} left", "New arrival", "Size S\u2013XL"],
    statuses: ["In stock", "Low stock", "Sold out", "Shipped", "Delivered", "Pre-order"],
    categories: ["New", "Clothing", "Home", "Accessories", "Sale"],
    meta: ["{#20-900} reviews", "${#12-180}", "\u2605 4.{#1-9}"],
    amount: ["${#12-180}.00", "${#9-99}.99"],
    columns: ["Product", "Details", "Status", "Reviews", "Category", "Buyer", "Ordered", "Price"],
    metrics: [{ label: "Orders", value: "{#20-240}", delta: "+{#4-30}" }, { label: "Revenue", value: "${#2-9},{#100-999}", delta: "+{#3-18}%" }, { label: "Returns", value: "{#1-9}", down: true, delta: "\u2212{#1-3}" }, { label: "Conversion", value: "{#1-4}.{#0-9}%" }],
    fields: [["Full name", "{name}"], ["Email", "{lower}@example.com"], ["Size", "M"], ["Colour", "Sand"], ["Quantity", "{#1-3}"], ["Gift note", "Happy birthday!"]],
    details: [["Material", "Organic cotton"], ["Fit", "Relaxed"], ["Care", "Machine wash cold"], ["Ships in", "{#1-3} days"]],
    lines: ["Made from organic cotton and cut for an easy fit.", "Free returns within 30 days.", "Ships in {#1-3} working days.", "Our best-seller this season.", "Pairs well with the canvas tote.", "Every order is packed without plastic."],
    remarks: ["Fits true to size.", "Colour is lovely in person.", "Arrived quickly, well packed.", "Bought a second one.", "A bit long in the sleeve.", "Great gift."],
    roles: ["Shopper since {date}", "Store manager"],
    profile: [["Orders", "{#2-60}"], ["Reviews", "{#1-30}"], ["Saved", "{#3-80}"]],
    pitch: ["Things worth keeping", "New pieces every week, free returns always."],
    empty: ["Your bag is empty", "Items you add will wait here."],
    success: ["Order placed", "We'll email you when it ships."],
    motifs: ["shirt", "shoe", "gift", "cup", "star", "box"]
  },
  {
    id: "fitness",
    name: "Fitness and training",
    about: "workouts, training plans, gyms, running, classes and activity tracking",
    noun: ["Workout", "Workouts"],
    home: "This week",
    titles: ["Morning run", "Upper body", "Leg day", "Tempo {#5-10}k", "Core blast", "Yoga flow", "HIIT {#15-30}", "Long ride", "Mobility", "Rowing intervals", "Full body", "Hill repeats", "Swim drills", "Pilates", "Recovery walk", "Push day", "Pull day", "Spin class", "Stretch & breathe", "Kettlebell circuit", "Easy {#3-8}k", "Boxing basics"],
    subs: ["{#20-75} min \xB7 {#200-800} kcal", "{#3-6} sets", "With {name}", "{#4-18} km", "Zone {#2-4}"],
    statuses: ["Planned", "Done", "Skipped", "In progress", "Personal best"],
    categories: ["Strength", "Cardio", "Mobility", "Classes", "Outdoor"],
    meta: ["{#20-75} min", "{#4-18}.{#0-9} km", "{time}"],
    amount: ["{#20-75} min", "{#200-800} kcal"],
    columns: ["Workout", "Details", "Status", "Time", "Type", "Coach", "Date", "Calories"],
    metrics: [{ label: "Workouts", value: "{#2-6}", delta: "+{#1-2}" }, { label: "Active min", value: "{#90-320}", delta: "+{#10-40}" }, { label: "Distance", value: "{#8-42} km" }, { label: "Streak", value: "{#3-21} days" }],
    fields: [["Workout", "Tempo run"], ["Duration", "{#20-75} min"], ["Distance", "{#4-18} km"], ["Effort", "Hard"], ["Date", "{date}"], ["Notes", "Felt strong"]],
    details: [["Duration", "{#20-75} min"], ["Calories", "{#200-800} kcal"], ["Avg heart rate", "{#120-165} bpm"], ["Coach", "{name}"]],
    lines: ["Warm up for ten minutes at an easy pace.", "Hold each position for 30 seconds.", "Keep the effort steady through the middle.", "Rest {#60-120} seconds between sets.", "Finish with a slow cool-down.", "Great for rest days."],
    remarks: ["New personal best!", "Legs are sore today.", "See you at the 7 am class.", "Swapped to the bike today.", "That last set was tough.", "{#5-10}k done before work."],
    roles: ["Runner \xB7 {#2-9} years", "Coach"],
    profile: [["Workouts", "{#40-600}"], ["Km", "{#200-3000}"], ["Streak", "{#3-60}"]],
    pitch: ["Train with a plan", "Workouts that fit your week, progress you can see."],
    empty: ["No workouts yet", "Log your first one to start a streak."],
    success: ["Workout logged", "{#20-75} minutes \u2014 nice work."],
    motifs: ["dumbbell", "bike", "heart-pulse", "chart", "calendar", "shoe"]
  },
  {
    id: "travel",
    name: "Travel and trips",
    about: "trips, flights, hotels, bookings, itineraries and travel planning",
    noun: ["Trip", "Trips"],
    home: "Upcoming",
    titles: ["Weekend by the lake", "Flight {A-F}{A-F} {#100-999}", "Coast road trip", "Mountain cabin", "City break", "Island hopping", "Hotel, 3 nights", "Night train", "Ski week", "Food tour", "Harbour ferry", "Desert camp", "Old town walk", "Vineyard stay", "Surf lessons", "Museum pass", "Car rental", "Hostel, 2 nights", "River cruise", "Hiking loop", "Market morning", "Canyon day trip"],
    subs: ["{date} \u2013 {date}", "{#2-6} travellers", "{#1-9} nights", "Gate {A-F}{#1-30} \xB7 {time}", "Booked by {name}"],
    statuses: ["Booked", "Checked in", "On time", "Delayed", "Planning", "Cancelled"],
    categories: ["Flights", "Stays", "Activities", "Transport", "Ideas"],
    meta: ["{date}", "{time}", "${#90-900}"],
    amount: ["${#90-1800}"],
    columns: ["Trip", "Dates", "Status", "When", "Type", "Traveller", "Booked", "Price"],
    metrics: [{ label: "Trips", value: "{#2-9}" }, { label: "Nights away", value: "{#6-40}" }, { label: "Days to go", value: "{#3-60}" }, { label: "Budget left", value: "${#200-2400}", delta: "\u2212${#20-200}", down: true }],
    fields: [["Destination", "Lakeside"], ["Check in", "{date}"], ["Check out", "{date}"], ["Guests", "{#1-6}"], ["Room", "Double"], ["Requests", "Late check-in"]],
    details: [["Dates", "{date} \u2013 {date}"], ["Guests", "{#1-6}"], ["Confirmation", "{A-F}{#10000-99999}"], ["Total", "${#200-1800}"]],
    lines: ["A quiet stay a short walk from the water.", "Breakfast is included every morning.", "Free cancellation until {date}.", "Check-in opens at {time}.", "The trail starts right behind the lodge.", "Bring layers \u2014 evenings get cold."],
    remarks: ["Can't wait for this one!", "Gate changed to {A-F}{#1-30}.", "Booked the ferry for {time}.", "Found a great caf\xE9 nearby.", "Pack the rain jackets.", "Upgrade came through."],
    roles: ["Traveller \xB7 {#4-40} trips", "Trip organiser"],
    profile: [["Trips", "{#4-40}"], ["Countries", "{#2-30}"], ["Reviews", "{#1-50}"]],
    pitch: ["Every trip in one place", "Flights, stays and plans \u2014 together, offline."],
    empty: ["No trips planned", "Add a booking to start your first trip."],
    success: ["You're booked", "Confirmation sent \u2014 have a great trip."],
    motifs: ["plane", "suitcase", "pin", "ticket", "camera", "house"]
  },
  {
    id: "events",
    name: "Events and tickets",
    about: "events, conferences, concerts, meetups, tickets and RSVPs",
    noun: ["Event", "Events"],
    home: "This week",
    titles: ["Design meetup", "Jazz in the park", "Night market", "Open studio", "Book launch", "Community run", "Film night", "Pottery workshop", "Tech talk: {A-F}I", "Summer fair", "Trivia night", "Gallery opening", "Comedy hour", "Makers market", "Choir concert", "Startup breakfast", "Poetry slam", "Board game night", "Dance class", "Food festival", "Climate talk", "Charity gala"],
    subs: ["{day} \xB7 {time}", "{#20-400} going", "Hosted by {name}", "Free", "Hall {A-F}"],
    statuses: ["Going", "Interested", "Sold out", "Waitlist", "Cancelled", "On sale"],
    categories: ["Music", "Talks", "Workshops", "Food", "Community"],
    meta: ["{day}", "{time}", "${#5-80}"],
    amount: ["${#5-80}", "Free"],
    columns: ["Event", "When", "Status", "Day", "Type", "Host", "Date", "Price"],
    metrics: [{ label: "RSVPs", value: "{#40-400}", delta: "+{#5-40}" }, { label: "Tickets sold", value: "{#60-98}%" }, { label: "Check-ins", value: "{#20-300}" }, { label: "Waitlist", value: "{#2-40}" }],
    fields: [["Event name", "Design meetup"], ["Date", "{date}"], ["Start", "{time}"], ["Venue", "Hall {A-F}"], ["Capacity", "{#40-400}"], ["Ticket price", "${#5-80}"]],
    details: [["When", "{date}, {time}"], ["Where", "Hall {A-F}"], ["Host", "{name}"], ["Tickets", "${#5-80}"]],
    lines: ["An evening of short talks and good conversation.", "Doors open at {time}; the first talk starts half an hour later.", "Tickets include one drink.", "Step-free access through the side entrance.", "Bring a friend \u2014 it's more fun.", "Limited seats, first come first served."],
    remarks: ["See you there!", "Is there parking nearby?", "Loved last month's one.", "Bringing two friends.", "Can I switch my ticket?", "Running {#5-15} min late."],
    roles: ["Organiser \xB7 {#3-60} events", "Regular"],
    profile: [["Events", "{#3-120}"], ["Going", "{#1-12}"], ["Followers", "{#20-4000}"]],
    pitch: ["Find something on tonight", "Events near you, tickets in your pocket."],
    empty: ["No events yet", "Events you save or book will show here."],
    success: ["You're going", "Your ticket is in the app \u2014 see you on {day}."],
    motifs: ["ticket", "calendar", "music", "pin", "star", "chat"]
  },
  {
    id: "finance",
    name: "Money and finance",
    about: "banking, budgets, expenses, payments, invoices and personal finance",
    noun: ["Transaction", "Transactions"],
    home: "Balance",
    titles: ["Groceries", "Rent", "Salary", "Coffee", "Electricity bill", "Gym membership", "Transfer to savings", "Refund", "Phone plan", "Train pass", "Dinner out", "Invoice #{#1000-1999}", "Insurance", "Bookshop", "Pharmacy", "Taxi", "Hardware store", "Streaming plan", "Farmers market", "Water bill", "Pet supplies", "Parking"],
    subs: ["Card \u2022\u2022 {#1000-9999}", "{day}", "Split with {name}", "Recurring", "Pending"],
    statuses: ["Completed", "Pending", "Declined", "Refunded", "Scheduled"],
    categories: ["Food", "Bills", "Transport", "Income", "Shopping"],
    meta: ["\u2212${#4-120}.{#00-99}", "+${#20-900}.00", "{day}"],
    amount: ["${#4-900}.{#00-99}"],
    columns: ["Payee", "Account", "Status", "Amount", "Category", "Paid by", "Date", "Total"],
    metrics: [{ label: "Balance", value: "${#1-9},{#100-999}", delta: "+${#20-400}" }, { label: "Spent this month", value: "${#600-2400}", delta: "+{#2-12}%", down: true }, { label: "Saved", value: "${#100-900}" }, { label: "Bills due", value: "{#1-5}" }],
    fields: [["Amount", "${#20-500}.00"], ["To", "{name}"], ["From account", "Everyday \u2022\u2022 {#1000-9999}"], ["Date", "{date}"], ["Reference", "Rent {date}"], ["Category", "Bills"]],
    details: [["Account", "Everyday \u2022\u2022 {#1000-9999}"], ["Date", "{date}"], ["Category", "Bills"], ["Reference", "{A-F}{#10000-99999}"]],
    lines: ["Your spending is lower than last month.", "Two bills are due before {date}.", "Round-ups added ${#4-40} to savings this week.", "This payment repeats every month.", "Transfers arrive within a working day.", "Tap a transaction to split it."],
    remarks: ["Paid you back for dinner.", "Split the taxi?", "Rent sent.", "That refund came through.", "Moved ${#50-500} to savings.", "Bill is higher than usual."],
    roles: ["Personal account", "Joint account with {first}"],
    profile: [["Accounts", "{#1-4}"], ["Saved", "${#1-9}k"], ["Goals", "{#1-5}"]],
    pitch: ["Know where it goes", "See every payment, budget in minutes, save automatically."],
    empty: ["No transactions yet", "Payments will appear here as they happen."],
    success: ["Payment sent", "It should arrive within a working day."],
    motifs: ["coin", "chart", "briefcase", "phone", "checklist", "key"]
  },
  {
    id: "tasks",
    name: "Tasks and projects",
    about: "to-do lists, tasks, project management, teams, sprints and issues",
    noun: ["Task", "Tasks"],
    home: "My day",
    titles: ["Draft the brief", "Review pull request", "Book venue", "Update roadmap", "Fix login bug", "Write release notes", "Plan sprint {#10-40}", "Call supplier", "Order new chairs", "Prepare demo", "Send invoice", "Team retro", "Interview candidate", "Clean up backlog", "Migrate database", "Design review", "Check analytics", "Renew licence", "Onboard {first}", "Test checkout", "Write test plan", "Archive old files"],
    subs: ["Due {day}", "Assigned to {name}", "{#1-9} subtasks", "Project Alder", "{#1-9} comments"],
    statuses: ["To do", "In progress", "In review", "Done", "Blocked"],
    categories: ["Design", "Engineering", "Ops", "Marketing", "Personal"],
    meta: ["{day}", "{#1-8} pts", "{date}"],
    amount: ["{#1-8} pts", "{#1-16} h"],
    columns: ["Task", "Details", "Status", "Due", "Area", "Assignee", "Created", "Estimate"],
    metrics: [{ label: "Open", value: "{#8-40}", delta: "\u2212{#1-6}", down: true }, { label: "Due today", value: "{#1-7}" }, { label: "Done this week", value: "{#6-30}", delta: "+{#2-9}" }, { label: "Blocked", value: "{#0-3}" }],
    fields: [["Title", "Draft the brief"], ["Assignee", "{name}"], ["Due date", "{date}"], ["Priority", "High"], ["Project", "Project Alder"], ["Description", "First pass by Friday"]],
    details: [["Assignee", "{name}"], ["Due", "{date}"], ["Priority", "High"], ["Estimate", "{#1-8} pts"]],
    lines: ["A first pass is enough \u2014 we'll review it together.", "Blocked until the design is signed off.", "Linked to two other tasks in this sprint.", "Priority raised after the customer call.", "Moved from last sprint.", "Check the notes before starting."],
    remarks: ["On it.", "Pushed a fix, can you review?", "Moving this to next sprint.", "Blocked on the API.", "Done \u2014 closing.", "Who has context here?"],
    roles: ["Product designer", "Engineering lead"],
    profile: [["Done", "{#40-900}"], ["Open", "{#3-30}"], ["Projects", "{#1-8}"]],
    pitch: ["Get the right things done", "Plan the day, share the load, ship on time."],
    empty: ["Nothing due", "Enjoy it \u2014 or add a task to plan ahead."],
    success: ["Task done", "{#1-9} left for today."],
    motifs: ["checklist", "calendar", "chart", "chat", "laptop", "briefcase"]
  },
  {
    id: "tools",
    name: "Tools and lending",
    about: "lending and borrowing tools, a tool library, rentals, equipment and sharing things with neighbours",
    noun: ["Tool", "Tools"],
    home: "Near you",
    titles: ["Cordless drill", "Step ladder", "Hedge trimmer", "Pressure washer", "Circular saw", "Tile cutter", "Stud finder", "Wheelbarrow", "Sander", "Socket set", "Paint sprayer", "Extension lead", "Carpet cleaner", "Jigsaw", "Lawn mower", "Camping stove", "Car jack", "Spirit level", "Glue gun", "Bolt cutters", "Leaf blower", "Clamp set"],
    subs: ["{#1-9} min away", "Lent by {name}", "Free \xB7 {#1-7} days", "Good condition", "Batteries included"],
    statuses: ["Available", "On loan", "Reserved", "Returned", "Overdue"],
    categories: ["Power tools", "Garden", "Ladders", "Cleaning", "Outdoors"],
    meta: ["{#1-9} min", "{#1-7} days", "${#0-15}/day"],
    amount: ["${#0-15}/day", "Free"],
    columns: ["Tool", "Details", "Status", "Distance", "Type", "Owner", "Due back", "Deposit"],
    metrics: [{ label: "Borrowed", value: "{#2-12}" }, { label: "Lent out", value: "{#1-8}", delta: "+{#1-3}" }, { label: "Due back", value: "{#1-4}" }, { label: "Neighbours", value: "{#12-90}" }],
    fields: [["Tool", "Cordless drill"], ["Pick-up", "{day}, {time}"], ["Return by", "{date}"], ["Deposit", "${#0-40}"], ["Condition", "Good"], ["Message", "Can I grab it after work?"]],
    details: [["Owner", "{name}"], ["Condition", "Good"], ["Loan length", "Up to {#1-7} days"], ["Deposit", "${#0-40}"]],
    lines: ["Comes with two batteries and a set of bits.", "Pick up from the porch \u2014 it's in the blue box.", "Please return it clean and charged.", "Lent {#3-40} times without a scratch.", "Ask before taking it overnight.", "Great for a weekend job."],
    remarks: ["Worked perfectly, thanks!", "Back on your porch.", "Can I keep it one more day?", "Battery was flat \u2014 charged it.", "Happy to lend anytime.", "Picked up at {time}."],
    roles: ["Neighbour \xB7 {#2-9} years", "Tool library volunteer"],
    profile: [["Lent", "{#3-80}"], ["Borrowed", "{#2-40}"], ["Rating", "4.{#6-9}"]],
    pitch: ["Borrow, don't buy", "Tools from your street, lent and returned with a tap."],
    empty: ["Nothing borrowed", "Find a tool nearby and ask to borrow it."],
    success: ["Request sent", "{first} will reply soon."],
    motifs: ["drill", "hammer", "ladder", "wrench", "house", "key"]
  },
  {
    id: "pets",
    name: "Pets and animal care",
    about: "pets, pet care, vets, dog walking, pet sitting and adoption",
    noun: ["Pet", "Pets"],
    home: "Today",
    titles: ["Biscuit", "Luna", "Pepper", "Mochi", "Otis", "Juniper", "Walk with Biscuit", "Vet check-up", "Flea treatment", "Grooming", "Puppy class", "Feeding", "Sitter: {first}", "Nail trim", "Vaccination", "Weigh-in", "Park meetup", "Dental clean", "Adopt: Ziggy", "Adopt: Clover", "Night-time pills", "Bath day"],
    subs: ["Dog \xB7 {#1-12} yrs", "Cat \xB7 {#1-16} yrs", "{time} \xB7 {#20-60} min", "With {name}", "Due {day}"],
    statuses: ["Due", "Done", "Booked", "Overdue", "Adoptable"],
    categories: ["Walks", "Health", "Food", "Grooming", "Training"],
    meta: ["{time}", "{#20-60} min", "{#3-40} kg"],
    amount: ["{#3-40} kg", "${#20-120}"],
    columns: ["Pet", "Details", "Status", "Time", "Care", "Carer", "Date", "Cost"],
    metrics: [{ label: "Walks", value: "{#8-21}", delta: "+{#1-4}" }, { label: "Km walked", value: "{#12-60}" }, { label: "Next vet", value: "{#2-30} days" }, { label: "Weight", value: "{#3-40} kg" }],
    fields: [["Pet's name", "Biscuit"], ["Species", "Dog"], ["Breed", "Mixed"], ["Age", "{#1-12}"], ["Vet", "Riverside Vets"], ["Notes", "Scared of thunder"]],
    details: [["Breed", "Mixed"], ["Age", "{#1-12} years"], ["Weight", "{#3-40} kg"], ["Vet", "Riverside Vets"]],
    lines: ["Friendly with other dogs, a little shy with people.", "Two walks a day, one of them long.", "Takes a pill with dinner.", "Loves the park by the river.", "Microchipped and vaccinated.", "Needs a quiet home with a garden."],
    remarks: ["Such a good walk today!", "Ate everything.", "A little limp \u2014 keeping an eye on it.", "Met {first}'s dog at the park.", "Bath done, very fluffy.", "Back home at {time}."],
    roles: ["Dog walker", "Pet parent"],
    profile: [["Walks", "{#20-900}"], ["Pets", "{#1-4}"], ["Rating", "4.{#6-9}"]],
    pitch: ["Happy pets, easy care", "Walks, meals and vet visits \u2014 all on one calendar."],
    empty: ["No pets yet", "Add your pet to start tracking their care."],
    success: ["Walk booked", "{first} will pick them up at {time}."],
    motifs: ["paw", "heart-pulse", "calendar", "house", "bowl", "camera"]
  },
  {
    id: "home-services",
    name: "Home services",
    about: "home repairs, cleaning, plumbers, electricians, handymen and booking services at home",
    noun: ["Job", "Jobs"],
    home: "Your home",
    titles: ["Leaky tap", "Deep clean", "Boiler service", "Fix fence panel", "Paint the hallway", "Gutter clearing", "Replace light fitting", "Window cleaning", "Assemble wardrobe", "Unblock drain", "Garden tidy", "Tile the bathroom", "Hang shelves", "Move sofa", "Smoke alarm check", "Carpet clean", "Fix door lock", "Seal the bath", "Lawn mowing", "Oven clean", "Mount the TV", "Bleed radiators"],
    subs: ["{day}, {time}", "With {name}", "{#1-4} h estimated", "Quote ${#40-400}", "{#1-9} photos"],
    statuses: ["Booked", "Quote sent", "In progress", "Completed", "Needs review"],
    categories: ["Plumbing", "Electrical", "Cleaning", "Garden", "Handyman"],
    meta: ["{day}", "${#40-400}", "{time}"],
    amount: ["${#40-400}"],
    columns: ["Job", "Details", "Status", "When", "Trade", "Pro", "Booked", "Quote"],
    metrics: [{ label: "Upcoming", value: "{#1-5}" }, { label: "Spent this year", value: "${#300-3000}" }, { label: "Pros hired", value: "{#2-12}" }, { label: "Avg rating", value: "4.{#5-9}" }],
    fields: [["What needs doing", "Leaky tap"], ["Room", "Kitchen"], ["Preferred day", "{day}"], ["Time", "{time}"], ["Budget", "${#40-400}"], ["Access notes", "Key under the mat"]],
    details: [["Pro", "{name}"], ["When", "{day}, {time}"], ["Estimate", "{#1-4} hours"], ["Quote", "${#40-400}"]],
    lines: ["Includes parts and an hour of labour.", "{first} has done {#20-300} jobs nearby.", "Photos help the pro quote accurately.", "Pay only when the job is done.", "Rescheduling is free up to a day before.", "Guaranteed for 90 days."],
    remarks: ["On my way \u2014 {#5-20} min.", "All fixed, sent photos.", "Needs one more part.", "Great job, thank you!", "Can we move to {day}?", "Left the key where you said."],
    roles: ["Plumber \xB7 {#3-20} years", "Homeowner"],
    profile: [["Jobs", "{#20-800}"], ["Rating", "4.{#6-9}"], ["Years", "{#2-25}"]],
    pitch: ["A pro at your door", "Book trusted help for any job around the house."],
    empty: ["No jobs yet", "Describe what needs doing and get quotes."],
    success: ["Job booked", "{first} will arrive {day} at {time}."],
    motifs: ["house", "wrench", "hammer", "key", "ladder", "calendar"]
  },
  {
    id: "jobs",
    name: "Jobs and hiring",
    about: "job listings, hiring, recruiting, candidates, applications and careers",
    noun: ["Job", "Jobs"],
    home: "For you",
    titles: ["Product designer", "Backend engineer", "Store manager", "Barista", "Data analyst", "Warehouse lead", "Nurse, nights", "Line cook", "Marketing lead", "Support specialist", "Electrician", "Teacher, year {#3-6}", "Delivery driver", "Office manager", "UX researcher", "Accountant", "Sales associate", "Project coordinator", "Carpenter", "Content writer", "QA engineer", "Receptionist"],
    subs: ["Remote \xB7 Full-time", "${#40-160}k", "{#1-30} applicants", "Posted {ago}", "Part-time \xB7 {#15-30} h/wk"],
    statuses: ["Open", "Applied", "Interviewing", "Offer", "Closed"],
    categories: ["Design", "Engineering", "Retail", "Hospitality", "Health"],
    meta: ["{ago}", "${#40-160}k", "Remote"],
    amount: ["${#40-160}k", "${#16-40}/h"],
    columns: ["Role", "Details", "Status", "Posted", "Team", "Recruiter", "Opened", "Salary"],
    metrics: [{ label: "Applications", value: "{#20-240}", delta: "+{#4-30}" }, { label: "Interviews", value: "{#3-18}" }, { label: "Offers", value: "{#1-4}" }, { label: "Time to hire", value: "{#12-40} days", delta: "\u2212{#1-5}", down: true }],
    fields: [["Full name", "{name}"], ["Email", "{lower}@example.com"], ["Role", "Product designer"], ["Experience", "{#2-12} years"], ["Portfolio", "example.com/{lower}"], ["Cover note", "I'd love to help"]],
    details: [["Team", "Design"], ["Location", "Remote"], ["Salary", "${#40-160}k"], ["Start", "{date}"]],
    lines: ["You'll work with a small team shipping every week.", "Flexible hours and a remote-first team.", "We'd love to hear what you've built.", "Interviews are two short conversations.", "Applications close on {date}.", "Training is paid and starts on day one."],
    remarks: ["Thanks for applying!", "Can we talk {day}?", "Loved your portfolio.", "Sent the take-home.", "Offer letter attached.", "We've filled this role."],
    roles: ["Product designer \xB7 {#2-12} yrs", "Recruiter"],
    profile: [["Applied", "{#2-30}"], ["Interviews", "{#1-9}"], ["Saved", "{#3-40}"]],
    pitch: ["Work that fits", "Roles matched to your skills, one tap to apply."],
    empty: ["No applications yet", "Save a job or apply to track it here."],
    success: ["Application sent", "You'll hear back within a week."],
    motifs: ["briefcase", "laptop", "chat", "calendar", "star", "checklist"]
  },
  {
    id: "news",
    name: "News and reading",
    about: "news, articles, magazines, blogs, newsletters and reading",
    noun: ["Story", "Stories"],
    home: "Top stories",
    titles: ["City council approves new bike lanes", "The quiet return of the corner shop", "Heatwave expected this weekend", "Local team wins the final", "What the new rail line means for you", "Inside the night market", "Five books to read this autumn", "Schools trial a four-day week", "The river cleanup, one year on", "How the harbour got its lights back", "A guide to the festival", "Rents rise for a third month", "The bakery that never closes", "Meet the city's beekeepers", "Storm clears, roads reopen", "Library extends its hours", "Why the tram is late", "A walk along the old canal", "New park opens in the east", "Theatre season announced", "Farm-to-table, reconsidered", "The last video shop"],
    subs: ["{#3-12} min read", "By {name}", "{ago}", "Opinion", "Updated {ago}"],
    statuses: ["New", "Saved", "Read", "Breaking", "Updated"],
    categories: ["Local", "Politics", "Culture", "Sport", "Weather"],
    meta: ["{ago}", "{#3-12} min", "{date}"],
    amount: ["{#3-12} min read"],
    columns: ["Headline", "Byline", "Status", "Published", "Section", "Editor", "Date", "Length"],
    metrics: [{ label: "Stories today", value: "{#12-60}" }, { label: "Readers", value: "{#2-90}k", delta: "+{#2-18}%" }, { label: "Saved", value: "{#3-40}" }, { label: "Read time", value: "{#3-12} min" }],
    fields: [["Headline", "Local team wins the final"], ["Section", "Sport"], ["Author", "{name}"], ["Publish at", "{time}"], ["Tags", "Local, sport"], ["Summary", "A late goal settles it"]],
    details: [["Author", "{name}"], ["Section", "Local"], ["Published", "{date}"], ["Read time", "{#3-12} min"]],
    lines: ["The plan passed late on Tuesday after a long debate.", "Residents say the change is overdue.", "Work is expected to begin in the spring.", "Not everyone is convinced it will help.", "The council will publish the full report next week.", "Here's what we know so far."],
    remarks: ["Great piece.", "This affects our street too.", "Any update on the timeline?", "Shared with my neighbours.", "Finally!", "Would love a follow-up."],
    roles: ["Reporter \xB7 City desk", "Reader since {date}"],
    profile: [["Articles", "{#20-900}"], ["Followers", "{#100-20000}"], ["Saved", "{#3-80}"]],
    pitch: ["The news that matters here", "Local stories, written by people who live here."],
    empty: ["Nothing saved", "Save a story to read it later."],
    success: ["Subscribed", "Your first newsletter arrives tomorrow."],
    motifs: ["newspaper", "book", "camera", "chat", "star", "image"]
  },
  {
    id: "music",
    name: "Music and audio",
    about: "music streaming, playlists, albums, artists, podcasts and audio",
    noun: ["Track", "Tracks"],
    home: "Listen now",
    titles: ["Late Summer", "Harbour Lights", "Slow Rivers", "Paper Moons", "Neon Rain", "Morning Walk", "Glasshouse", "Blue Hour", "Tidal", "Low Tide Radio", "Kite Season", "Salt & Honey", "Afterglow", "Velvet Static", "North Road", "Quiet Engines", "Golden Fields", "Night Ferry", "Cloud Atlas Mix", "Focus Beats", "Sunday Jazz", "Deep Work"],
    subs: ["The Lanterns", "Mira Vale", "{#8-40} tracks", "Podcast \xB7 Ep. {#10-99}", "Playlist by {name}"],
    statuses: ["Playing", "Downloaded", "Liked", "New release", "Queued"],
    categories: ["Pop", "Jazz", "Chill", "Podcasts", "Focus"],
    meta: ["{#2-5}:{#00-59}", "{#20-60} min", "{#1-9}.{#0-9}M plays"],
    amount: ["{#2-5}:{#00-59}"],
    columns: ["Title", "Artist", "Status", "Length", "Genre", "Added by", "Added", "Plays"],
    metrics: [{ label: "Minutes", value: "{#300-2400}", delta: "+{#20-200}" }, { label: "Artists", value: "{#12-90}" }, { label: "Playlists", value: "{#3-24}" }, { label: "Downloads", value: "{#20-400}" }],
    fields: [["Playlist name", "Sunday Jazz"], ["Description", "Slow and warm"], ["Visibility", "Private"], ["Cover", "Auto"], ["Collaborators", "{name}"], ["Tags", "Jazz, chill"]],
    details: [["Artist", "The Lanterns"], ["Album", "Harbour Lights"], ["Released", "{date}"], ["Length", "{#30-60} min"]],
    lines: ["A slow, warm record made for late evenings.", "Recorded live in one take.", "New episodes every Tuesday.", "Mixed for focus \u2014 no lyrics.", "The band's first album in five years.", "Updated every Friday."],
    remarks: ["On repeat all week.", "That bridge at 2:10!", "Saw them live last year.", "Perfect for work.", "Added to my playlist.", "Where can I hear more like this?"],
    roles: ["Listener since {date}", "Artist"],
    profile: [["Playlists", "{#3-40}"], ["Followers", "{#10-9000}"], ["Following", "{#10-400}"]],
    pitch: ["Music for every moment", "Mixes made for you, offline when you need them."],
    empty: ["Nothing here yet", "Like a track and it will show up here."],
    success: ["Playlist saved", "{#8-40} tracks, ready offline."],
    motifs: ["music", "star", "heart-pulse", "phone", "image", "chat"]
  },
  {
    id: "learning",
    name: "Learning and courses",
    about: "courses, lessons, schools, students, teachers, quizzes and education",
    noun: ["Course", "Courses"],
    home: "Keep learning",
    titles: ["Intro to watercolour", "Spanish for travel", "Algebra refresher", "Photography basics", "Public speaking", "Python in a week", "Knitting 101", "Bookkeeping", "World history: part {#1-4}", "Beginner guitar", "Data literacy", "Creative writing", "First aid", "Chemistry lab", "Mandarin tones", "Sketching people", "Home electrics", "Negotiation", "Music theory", "Budgeting basics", "Garden design", "Chess openings"],
    subs: ["{#4-20} lessons", "Lesson {#1-12} of 12", "With {name}", "{#20-90} min", "{#60-99}% complete"],
    statuses: ["Not started", "In progress", "Completed", "Due", "Graded"],
    categories: ["Languages", "Art", "Maths", "Business", "Science"],
    meta: ["{#10-45} min", "{#60-99}%", "{day}"],
    amount: ["{#4-20} lessons", "${#0-90}"],
    columns: ["Course", "Progress", "Status", "Length", "Subject", "Teacher", "Started", "Price"],
    metrics: [{ label: "Streak", value: "{#3-40} days", delta: "+1" }, { label: "Lessons done", value: "{#12-120}" }, { label: "Avg score", value: "{#72-98}%" }, { label: "Hours", value: "{#6-80}" }],
    fields: [["Course", "Spanish for travel"], ["Level", "Beginner"], ["Goal", "{#10-30} min a day"], ["Start date", "{date}"], ["Reminders", "{time}"], ["Why", "A trip in the spring"]],
    details: [["Teacher", "{name}"], ["Lessons", "{#4-20}"], ["Level", "Beginner"], ["Certificate", "Included"]],
    lines: ["Short lessons you can finish on the bus.", "Each lesson ends with a five-question quiz.", "You'll build a small project by the end.", "Practise speaking with voice exercises.", "Pick up where you left off on any device.", "Join the weekly live session."],
    remarks: ["Finally understood fractions!", "Lesson {#3-9} was hard.", "Great examples.", "Can we get more practice?", "Just got my certificate.", "See you in class {day}."],
    roles: ["Student", "Teacher \xB7 {#3-20} years"],
    profile: [["Courses", "{#1-20}"], ["Streak", "{#3-60}"], ["Certificates", "{#0-8}"]],
    pitch: ["Learn something new", "Ten minutes a day, one small step at a time."],
    empty: ["No courses yet", "Pick a course to start learning."],
    success: ["Lesson complete", "{#72-98}% \u2014 on to the next one."],
    motifs: ["book", "cap", "laptop", "checklist", "star", "chart"]
  },
  {
    id: "health",
    name: "Health and care",
    about: "health, clinics, doctors, appointments, medication, patients and wellbeing",
    noun: ["Appointment", "Appointments"],
    home: "Your health",
    titles: ["Annual check-up", "Dental clean", "Blood test", "Physio session", "Eye exam", "Flu vaccine", "Therapy session", "Skin check", "Follow-up call", "Vitamin D, daily", "Blood pressure log", "Allergy review", "Hearing test", "Prescription refill", "Nutrition consult", "Sleep diary", "Knee X-ray", "Mental health check-in", "Travel vaccines", "Walk {#5-10}k steps", "Iron, weekly", "Stretching routine"],
    subs: ["{day}, {time}", "With Dr {first}", "Room {#1-20}", "Video call", "Take with food"],
    statuses: ["Booked", "Confirmed", "Completed", "Due", "Missed"],
    categories: ["Appointments", "Medication", "Tests", "Activity", "Wellbeing"],
    meta: ["{time}", "{day}", "{#1-3} \xD7 day"],
    amount: ["{#15-60} min"],
    columns: ["Appointment", "Details", "Status", "Time", "Type", "Clinician", "Date", "Length"],
    metrics: [{ label: "Steps", value: "{#4-12},{#100-999}", delta: "+{#200-900}" }, { label: "Resting HR", value: "{#56-74} bpm" }, { label: "Sleep", value: "{#6-8} h {#00-59} m" }, { label: "Meds taken", value: "{#80-100}%" }],
    fields: [["Full name", "{name}"], ["Date of birth", "{date}"], ["Reason", "Annual check-up"], ["Preferred time", "{time}"], ["Clinic", "Riverside Clinic"], ["Symptoms", "None"]],
    details: [["Clinician", "Dr {first}"], ["When", "{day}, {time}"], ["Where", "Room {#1-20}"], ["Length", "{#15-60} min"]],
    lines: ["Arrive ten minutes early to check in.", "Bring a list of any medication you take.", "Results are usually ready within three days.", "You can join by video from home.", "Drink water before a blood test.", "Reschedule free of charge up to a day before."],
    remarks: ["Feeling much better.", "Results look normal.", "Can I move to {day}?", "Remember to fast before.", "Refill sent to the pharmacy.", "See you at {time}."],
    roles: ["Patient", "Nurse practitioner"],
    profile: [["Visits", "{#2-30}"], ["Streak", "{#3-60}"], ["Records", "{#4-80}"]],
    pitch: ["Care that fits your life", "Book visits, track medication and see results in one place."],
    empty: ["No appointments", "Book one when you need it."],
    success: ["Appointment booked", "{day} at {time} \u2014 we'll remind you."],
    motifs: ["heart-pulse", "pill", "calendar", "chat", "chart", "checklist"]
  },
  {
    id: "real-estate",
    name: "Homes and property",
    about: "homes for sale or rent, property listings, estate agents, viewings and landlords",
    noun: ["Home", "Homes"],
    home: "Homes for you",
    titles: ["Two-bed flat with balcony", "Garden cottage", "Loft near the river", "Family house, 4 bed", "Studio, top floor", "Terrace with courtyard", "Converted warehouse", "Ground-floor flat", "Townhouse, 3 bed", "Bungalow with drive", "Penthouse", "Shared house, 1 room", "Canal-side flat", "Victorian semi", "New-build duplex", "Mews house", "Farmhouse", "Houseboat", "Garden flat", "Corner house", "Studio by the park", "Cabin plot"],
    subs: ["{#1-5} bed \xB7 {#1-3} bath", "{#40-180} m\xB2", "{#1-9} min to the station", "Viewing {day}", "Listed {ago}"],
    statuses: ["For sale", "To let", "Under offer", "Sold", "Viewing booked"],
    categories: ["Flats", "Houses", "New builds", "Rentals", "Land"],
    meta: ["{#40-180} m\xB2", "${#250-900}k", "${#1-4},{#100-900}/mo"],
    amount: ["${#250-900},000", "${#1-4},{#100-900}/mo"],
    columns: ["Property", "Details", "Status", "Size", "Type", "Agent", "Listed", "Price"],
    metrics: [{ label: "Saved homes", value: "{#3-30}" }, { label: "Viewings", value: "{#1-6}" }, { label: "New today", value: "{#2-18}", delta: "+{#1-6}" }, { label: "Avg price", value: "${#300-800}k" }],
    fields: [["Area", "Riverside"], ["Budget", "Up to ${#300-900}k"], ["Bedrooms", "{#1-5}"], ["Move-in", "{date}"], ["Must have", "Garden"], ["Viewing time", "{day}, {time}"]],
    details: [["Bedrooms", "{#1-5}"], ["Bathrooms", "{#1-3}"], ["Size", "{#40-180} m\xB2"], ["Agent", "{name}"]],
    lines: ["Bright rooms with tall windows and wooden floors.", "A short walk to the station and the park.", "Newly fitted kitchen with space to eat.", "South-facing garden with a shed.", "No onward chain.", "Viewings available this weekend."],
    remarks: ["Loved the light in this one.", "Is the garden shared?", "Booked a viewing for {day}.", "Price just dropped.", "Offer accepted!", "Too far from work for us."],
    roles: ["Home hunter", "Agent \xB7 {#2-20} years"],
    profile: [["Saved", "{#3-60}"], ["Viewings", "{#1-20}"], ["Alerts", "{#1-6}"]],
    pitch: ["Find your next home", "New listings the minute they land, viewings in a tap."],
    empty: ["No saved homes", "Save a listing to compare it later."],
    success: ["Viewing booked", "{first} will meet you on {day} at {time}."],
    motifs: ["house", "key", "pin", "camera", "calendar", "leaf"]
  },
  {
    id: "social",
    name: "Social and community",
    about: "social networks, communities, groups, friends, posts, messaging and neighbourhoods",
    noun: ["Post", "Posts"],
    home: "Your feed",
    titles: ["Sunset from the pier", "Anyone up for a run?", "New caf\xE9 on the corner", "Lost cat \u2014 grey tabby", "Garden swap this Sunday", "My first loaf!", "Book club pick", "Road closed on the high street", "Free sofa, must collect", "Street party photos", "Recommend a plumber?", "Morning swim crew", "Kids' football results", "The mural is finished", "Found keys by the bus stop", "Community fridge restocked", "Litter pick, {day}", "Choir needs tenors", "Balcony tomatoes", "Rain again\u2026", "Quiz night winners", "Welcome, new neighbours"],
    subs: ["{name} \xB7 {ago}", "{#2-90} likes", "{#1-40} comments", "In Riverside", "Shared by {name}"],
    statuses: ["New", "Popular", "Pinned", "Following", "Resolved"],
    categories: ["Neighbours", "Events", "For sale", "Lost & found", "Photos"],
    meta: ["{ago}", "{#2-90} \u2661", "{#1-40} replies"],
    amount: ["{#2-90} likes"],
    columns: ["Post", "Author", "Status", "Posted", "Group", "Member", "Date", "Likes"],
    metrics: [{ label: "Followers", value: "{#40-900}", delta: "+{#2-20}" }, { label: "Posts", value: "{#12-300}" }, { label: "Groups", value: "{#2-12}" }, { label: "Replies", value: "{#10-90}" }],
    fields: [["Display name", "{name}"], ["Username", "@{lower}"], ["Neighbourhood", "Riverside"], ["Bio", "Coffee, bikes, plants"], ["Website", "example.com/{lower}"], ["Birthday", "{date}"]],
    details: [["Joined", "{date}"], ["Neighbourhood", "Riverside"], ["Groups", "{#2-12}"], ["Posts", "{#12-300}"]],
    lines: ["Caught this on the way home \u2014 the sky was unreal.", "Meeting at the gate at seven, all paces welcome.", "Free to a good home, just come and grab it.", "Thanks to everyone who came along!", "Anyone know who does this kind of repair?", "More photos in the album."],
    remarks: ["So beautiful!", "Count me in.", "Thanks for sharing.", "I'll come by at {time}.", "Congrats!", "Which street is this?"],
    roles: ["Riverside \xB7 member since {date}", "Group admin"],
    profile: [["Posts", "{#12-300}"], ["Followers", "{#40-900}"], ["Following", "{#20-400}"]],
    pitch: ["Know your neighbours", "Share, swap and help out on your street."],
    empty: ["It's quiet here", "Follow people and groups to fill your feed."],
    success: ["Posted", "Your neighbours can see it now."],
    motifs: ["chat", "camera", "image", "heart-pulse", "house", "star"]
  },
  {
    id: "rides",
    name: "Rides and transport",
    about: "ride hailing, taxis, car sharing, bike hire, public transport and fleets of vehicles",
    noun: ["Ride", "Rides"],
    home: "Where to?",
    titles: ["Home", "Work", "Station", "Airport run", "Ride to the gym", "Evening pickup", "Bike {#100-999}", "Van {A-F}{#10-99}", "Shuttle {#1-9}", "Car {#1000-9999}", "School run", "Late train home", "Ride to the clinic", "Hire: city bike", "Scooter {#100-999}", "Night bus {#10-99}", "Weekend car share", "Ride to the match", "Market trip", "Hotel transfer", "Commute", "Ferry terminal"],
    subs: ["{#4-40} min \xB7 {#2-30} km", "Driver {name}", "Arrives {time}", "{#2-6} seats", "Battery {#40-99}%"],
    statuses: ["Arriving", "On trip", "Completed", "Scheduled", "Cancelled"],
    categories: ["Cars", "Bikes", "Scooters", "Transit", "Shared"],
    meta: ["{#2-12} min", "${#6-48}", "{#2-30} km"],
    amount: ["${#6-48}.{#00-99}"],
    columns: ["Trip", "Details", "Status", "ETA", "Mode", "Driver", "Date", "Fare"],
    metrics: [{ label: "Trips", value: "{#4-40}", delta: "+{#1-6}" }, { label: "Km", value: "{#20-300}" }, { label: "Spent", value: "${#40-400}" }, { label: "CO\u2082 saved", value: "{#2-40} kg" }],
    fields: [["Pickup", "Current location"], ["Drop-off", "Station"], ["When", "Now"], ["Passengers", "{#1-4}"], ["Payment", "Card \u2022\u2022 {#1000-9999}"], ["Note to driver", "By the blue door"]],
    details: [["Driver", "{name}"], ["Vehicle", "Grey hatchback"], ["Plate", "{A-F}{A-F}{#10-99} {A-F}{A-F}{A-F}"], ["Fare", "${#6-48}"]],
    lines: ["Your driver is {#2-9} minutes away.", "Meet at the pickup point by the main entrance.", "Fares include tolls and taxes.", "Share your trip with a friend for peace of mind.", "Bikes can be left in any marked bay.", "Scheduled rides can be changed until an hour before."],
    remarks: ["Great driver, smooth ride.", "Running a couple of minutes late.", "At the front entrance.", "Left my umbrella in the car.", "Thanks for waiting!", "Traffic on the bridge."],
    roles: ["Rider since {date}", "Driver \xB7 {#200-5000} trips"],
    profile: [["Trips", "{#10-900}"], ["Rating", "4.{#6-9}"], ["Years", "{#1-8}"]],
    pitch: ["Get there, easily", "A ride, a bike or the next train \u2014 in one app."],
    empty: ["No trips yet", "Your rides will show up here."],
    success: ["Ride booked", "{first} arrives at {time}."],
    motifs: ["car", "bike", "pin", "phone", "ticket", "calendar"]
  },
  {
    id: "plants",
    name: "Plants and gardening",
    about: "gardening, plants, plant care, allotments, seeds, watering and nurseries",
    noun: ["Plant", "Plants"],
    home: "Your garden",
    titles: ["Monstera", "Fiddle-leaf fig", "Snake plant", "Basil", "Tomatoes, cherry", "Lavender", "Peace lily", "Pothos", "Rosemary", "Chilli pepper", "Olive tree", "Succulent tray", "Sunflowers", "Mint", "Aloe", "Fern, Boston", "Strawberries", "Runner beans", "Rubber plant", "Orchid", "Cactus", "Hydrangea"],
    subs: ["Water in {#1-7} days", "Bright, indirect light", "Planted {date}", "Bed {#1-6}", "Repot soon"],
    statuses: ["Thirsty", "Healthy", "Needs light", "Blooming", "Harvest ready"],
    categories: ["Indoor", "Herbs", "Veg", "Flowers", "Succulents"],
    meta: ["{#1-7} days", "{day}", "{#10-180} cm"],
    amount: ["${#4-60}"],
    columns: ["Plant", "Care", "Status", "Next water", "Type", "Grower", "Planted", "Price"],
    metrics: [{ label: "Plants", value: "{#6-40}" }, { label: "Water today", value: "{#1-8}" }, { label: "Harvested", value: "{#1-9} kg", delta: "+{#1-3}" }, { label: "Streak", value: "{#3-40} days" }],
    fields: [["Plant name", "Monstera"], ["Where", "Living room"], ["Light", "Bright, indirect"], ["Water every", "{#3-10} days"], ["Pot size", "{#12-30} cm"], ["Notes", "New leaf unfurling"]],
    details: [["Light", "Bright, indirect"], ["Water", "Every {#3-10} days"], ["Height", "{#10-180} cm"], ["Planted", "{date}"]],
    lines: ["Let the top of the soil dry out between waterings.", "Turn it a quarter each week so it grows evenly.", "Feed once a month in spring and summer.", "Yellow leaves usually mean too much water.", "Pinch out the tips to keep it bushy.", "Bring it inside before the first frost."],
    remarks: ["New leaf this morning!", "Is this too much sun?", "First tomatoes of the year.", "Repotted, looking happier.", "Swapping cuttings on {day}.", "Aphids again\u2026"],
    roles: ["Balcony gardener", "Allotment {#1-60}"],
    profile: [["Plants", "{#6-80}"], ["Harvests", "{#2-40}"], ["Swaps", "{#1-20}"]],
    pitch: ["Keep every plant happy", "Reminders to water, feed and repot \u2014 plant by plant."],
    empty: ["No plants yet", "Add a plant to get care reminders."],
    success: ["Watered", "Next one's due in {#2-7} days."],
    motifs: ["leaf", "plant", "calendar", "house", "camera", "checklist"]
  },
  {
    id: "support",
    name: "Support and help desk",
    about: "customer support, help desks, tickets, service requests, IT help and complaints",
    noun: ["Ticket", "Tickets"],
    home: "Inbox",
    titles: ["Can't sign in", "Refund request #{#1000-9999}", "App crashes on launch", "Change billing address", "Order never arrived", "Password reset loop", "Feature request: dark mode", "Wrong item received", "Slow loading", "Cancel subscription", "Invoice missing", "Printer offline", "Account locked", "Update email", "Broken link on page", "Export not working", "Double charged", "Delivery damaged", "Can't upload photo", "Two-factor issue", "Question about pricing", "VPN won't connect"],
    subs: ["From {name}", "#{#1000-9999} \xB7 {ago}", "{#1-9} replies", "Priority: High", "Assigned to {first}"],
    statuses: ["Open", "Pending", "Solved", "Urgent", "Waiting on customer"],
    categories: ["Billing", "Account", "Bugs", "Orders", "Questions"],
    meta: ["{ago}", "{#1-48} h", "#{#1000-9999}"],
    amount: ["{#1-48} h"],
    columns: ["Subject", "Requester", "Status", "Updated", "Type", "Agent", "Opened", "Wait"],
    metrics: [{ label: "Open", value: "{#8-60}", delta: "\u2212{#1-9}", down: true }, { label: "First reply", value: "{#12-90} min" }, { label: "Solved today", value: "{#10-80}", delta: "+{#2-12}" }, { label: "Satisfaction", value: "9{#0-8}%" }],
    fields: [["Subject", "Can't sign in"], ["Email", "{lower}@example.com"], ["Category", "Account"], ["Priority", "Normal"], ["Order number", "#{#1000-9999}"], ["Describe the problem", "It says my code expired"]],
    details: [["Requester", "{name}"], ["Priority", "High"], ["Agent", "{name}"], ["Opened", "{date}"]],
    lines: ["The customer can't get past the sign-in screen.", "Tried clearing the cache \u2014 no change.", "Happened after the latest update.", "They'd like a call back this afternoon.", "Linked to {#2-9} similar tickets.", "Refund approved, waiting on the bank."],
    remarks: ["Thanks, that fixed it!", "Still seeing the error.", "Escalating to the team.", "Can you send a screenshot?", "Refund issued.", "Closing \u2014 reopen anytime."],
    roles: ["Support agent \xB7 Tier {#1-2}", "Team lead"],
    profile: [["Solved", "{#200-4000}"], ["CSAT", "9{#0-8}%"], ["Open", "{#2-20}"]],
    pitch: ["Help, fast", "Every request in one inbox, answered in minutes."],
    empty: ["Inbox zero", "New tickets will land here."],
    success: ["Ticket solved", "The customer has been notified."],
    motifs: ["headset", "chat", "checklist", "laptop", "phone", "star"]
  }
];
var PACK_BY_ID = new Map(PACKS.map((p) => [p.id, p]));
var PACK_IDS = PACKS.map((p) => p.id);
var GENERIC_PACK = "generic";

// packages/modules/wireframe/src/content/pack.ts
var FIRST_NAMES = [
  "Priya",
  "Tom\xE1s",
  "Aisha",
  "Kenji",
  "Maya",
  "Luca",
  "Zanele",
  "Omar",
  "Ingrid",
  "Mateo",
  "Leila",
  "Chen",
  "Amara",
  "Jonas",
  "Sofia",
  "Ravi",
  "Nia",
  "Felix",
  "Yuki",
  "Diego",
  "Hana",
  "Kofi",
  "Elena",
  "Arjun",
  "Freya",
  "Malik",
  "Rosa",
  "Tariq",
  "Lena",
  "Emeka",
  "Mei",
  "Nikolai",
  "Ana",
  "Idris",
  "Clara",
  "Sanjay",
  "Imani",
  "Oskar",
  "Luc\xEDa",
  "Ahmed",
  "Wren",
  "Tuan",
  "Farah",
  "Bruno",
  "Ayo",
  "Greta",
  "Ishaan",
  "Noor"
];
var INITIALS = "ABCDEFGHJKLMNOPRSTVWY";
var DAYS = ["Today", "Today", "Yesterday", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Tomorrow"];
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var SETTINGS_ROWS = [
  ["Notifications", ""],
  ["Language", "English"],
  ["Dark mode", ""],
  ["Account", "{first}"],
  ["Privacy", ""],
  ["Units", "Metric"],
  ["Sound", ""],
  ["Help and feedback", ""],
  ["Storage", "{#1-9}.{#0-9} GB"],
  ["Sign-in and security", ""]
];
var GENERIC = {
  email: "{lower}@example.com",
  password: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
  phone: "+1 555 01{#10-99}",
  code: "{#100000-999999}",
  steps: ["Details", "Address", "Schedule", "Review", "Payment", "Done"],
  noResults: ["No matches", "Try a different word or clear a filter."],
  cleared: ["All caught up", "Nothing left here \u2014 new ones will appear as they arrive."],
  signInLead: ["Welcome back", "Sign in to pick up where you left off."],
  signUpLead: ["Create your account", "It takes less than a minute."],
  verifyLead: ["Check your phone", "Enter the code we sent to \u2022\u2022\u2022\u2022 {#10-99}."],
  forgotLead: ["Reset your password", "We'll email you a link to choose a new one."],
  sentLead: ["Check your email", "A reset link is on its way."],
  errors: {
    "404": "This page has moved or never existed.",
    offline: "You're offline. Check your connection and try again.",
    generic: "Something went wrong on our side. Try again in a moment.",
    permission: "Ask the owner for access to see this."
  },
  filterGroups: ["Status", "Category", "Date"],
  sectionHeads: ["Today", "Earlier this week", "Last week"],
  crumbs: ["Home", "All"],
  newsletter: "Get updates"
};

// packages/modules/wireframe/src/content/fill.ts
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function singular(text) {
  return text.replace(/(^|[^\d.,])1 ([a-z]+?)(ies|s)\b/g, (whole, pre, stem, end) => stem.length < 2 || /ss$/.test(stem + end) ? whole : `${pre}1 ${stem}${end === "ies" ? "y" : ""}`);
}
var Ink = class {
  next;
  constructor(seed) {
    this.next = rng(seed);
  }
  int(a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
  name() {
    return `${this.pick(FIRST_NAMES)} ${this.pick(INITIALS.split(""))}.`;
  }
  x(template) {
    return singular(this.expand(template));
  }
  expand(template) {
    return template.replace(/\{([^}]+)\}/g, (whole, token) => {
      const range = /^#(\d+)-(\d+)$/.exec(token);
      if (range) {
        const [lo, hi] = [range[1], range[2]];
        const n = this.int(Number(lo), Number(hi));
        return lo.length > 1 && lo.startsWith("0") ? String(n).padStart(lo.length, "0") : String(n);
      }
      const letters = /^([A-Z])-([A-Z])$/.exec(token);
      if (letters) return String.fromCharCode(this.int(letters[1].charCodeAt(0), letters[2].charCodeAt(0)));
      switch (token) {
        case "name":
          return this.name();
        case "first":
          return this.pick(FIRST_NAMES);
        case "lower":
          return this.pick(FIRST_NAMES).toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
        case "time":
          return `${this.int(7, 19)}:${String(this.int(0, 11) * 5).padStart(2, "0")}`;
        case "day":
          return this.pick(DAYS);
        case "date":
          return `${this.pick(MONTHS)} ${this.int(1, 28)}`;
        case "ago":
          return this.next() < 0.5 ? `${this.int(2, 55)} min ago` : `${this.int(1, 9)} h ago`;
        default:
          return whole;
      }
    });
  }
};
function entity(pack, flow, k) {
  const n = pack.titles.length;
  const i = (k % n + n) % n;
  const ink = new Ink(hash(`${pack.id}|${flow}|entity|${i}`));
  return {
    title: ink.x(pack.titles[i]),
    sub: ink.x(ink.pick(pack.subs)),
    status: ink.pick(pack.statuses),
    // The first meta is the one a table's column names, so every row says the same kind of thing.
    meta: ink.x(pack.meta[0]),
    category: ink.pick(pack.categories),
    person: ink.name(),
    date: ink.x(ink.pick(["{day}", "{date}", "{date}"])),
    amount: ink.x(ink.pick(pack.amount)),
    // A thing's picture is one of the domain's own objects — the pack's first three motifs.
    motif: pack.motifs[(i + hash(flow)) % Math.min(3, pack.motifs.length)]
  };
}
var STEPS = [1, 3, 5, 7, 11, 13];
function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}
var Picker = class {
  constructor(pack, flow, key, slot, lead) {
    this.pack = pack;
    this.flow = flow;
    this.key = key;
    this.slot = slot;
    this.lead = lead;
    const seed = hash(`${key}|${slot}`);
    this.ink = new Ink(seed);
    this.n = pack.titles.length;
    this.start = seed % this.n;
    this.step = STEPS.filter((s) => gcd(s, this.n) === 1)[seed % 3] ?? 1;
  }
  pack;
  flow;
  key;
  slot;
  lead;
  ink;
  start;
  step;
  n;
  /** The flow's focus: the entity its detail screen shows, and the first row of every lead list. */
  get focusIndex() {
    return hash(`${this.pack.id}|${this.flow}|focus`) % this.n;
  }
  focus() {
    return entity(this.pack, this.flow, this.focusIndex);
  }
  /** n entities for this slot: the focus first in a lead slot, then a seeded walk that skips it. */
  entities(count) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    if (this.lead) {
      out.push(this.focus());
      seen.add(this.focusIndex);
    }
    for (let j = 0; out.length < count && j < count + this.n; j++) {
      const k = (this.start + j * this.step) % this.n;
      if (seen.has(k) && seen.size < this.n) continue;
      seen.add(k);
      out.push(entity(this.pack, this.flow, k));
    }
    return out;
  }
  /** n from a list, cycling from a seeded offset (or from the start when `from0`). */
  cycle(list, count, from0 = false) {
    const off = from0 ? 0 : this.start % list.length;
    return Array.from({ length: count }, (_, i) => list[(off + i) % list.length]);
  }
  x(template) {
    return this.ink.x(template);
  }
  sentences(count) {
    return this.cycle(this.pack.lines, count).map((l) => this.x(l));
  }
};
var num = (props, key) => Number(props[key]);
var lower = (s) => s.toLowerCase();
function rowItems(c, n, opts = {}) {
  return c.p.entities(n).map((e) => ({
    title: e.title,
    ...opts.lines === void 0 || opts.lines >= 2 ? { sub: e.sub } : {},
    status: e.status,
    meta: e.meta,
    person: e.person,
    motif: e.motif
  }));
}
function stats(c, n) {
  return c.p.cycle(c.p.pack.metrics, n, true).map((m) => ({
    label: m.label,
    value: c.p.x(m.value),
    ...m.delta ? { delta: c.p.x(m.delta) } : {},
    ...m.down ? { down: true } : {}
  }));
}
var ACCOUNT_FIELDS = [
  ["Full name", "{name}"],
  ["Email", GENERIC.email],
  ["Phone", GENERIC.phone],
  ["Language", "English"],
  ["Time zone", "GMT+{#1-9}"],
  ["Password", GENERIC.password]
];
var ACCOUNT_ARCHETYPES = /* @__PURE__ */ new Set(["sign-up", "settings"]);
function fieldPairs(c, n, skipFirst = 0) {
  const pairs = c.p.cycle(ACCOUNT_ARCHETYPES.has(c.archetype) ? ACCOUNT_FIELDS : c.p.pack.fields, n + skipFirst, true).slice(skipFirst);
  return { labels: pairs.map(([l]) => l), values: pairs.map(([, v]) => c.p.x(v)) };
}
function series(c, count) {
  return Array.from({ length: count }, () => Array.from({ length: 7 }, () => c.p.ink.int(25, 95)));
}
var LEGAL_HEADS = ["Your account", "Using the service", "Payments and refunds", "Your content", "Privacy", "Ending this agreement"];
var FILLERS = {
  // ---- primitives
  image: ({ p, props }) => ({ motif: p.pack.motifs[0], ...props.caption === true ? { lines: [p.focus().title] } : {} }),
  text: ({ p, props, archetype }) => ({ lines: archetype === "welcome" ? [p.pack.pitch[1]] : p.sentences(Math.max(1, Math.ceil(num(props, "lines") * 0.6))) }),
  "description-list": ({ p, props }) => {
    const e = p.focus();
    const c = p.pack.columns;
    const own = [[c[1], e.sub], [c[4], e.category], [c[5], e.person], [c[6], e.date], [c[7], e.amount]];
    const more = p.pack.details.filter(([l]) => !own.some(([o]) => o === l)).map(([l, v]) => [l, p.x(v)]);
    const pairs = [...own, ...more].slice(0, num(props, "pairs"));
    return { labels: pairs.map(([l]) => l), values: pairs.map(([, v]) => v) };
  },
  chip: ({ p, props }) => ({ labels: ["All", ...p.pack.categories].slice(0, num(props, "count")) }),
  list: (c) => ({ items: rowItems(c, num(c.props, "rows"), { lines: num(c.props, "lines") }) }),
  "search-field": ({ p }) => ({ labels: [`Search ${lower(p.pack.noun[1])}`], values: [lower(p.focus().category)] }),
  "segmented-control": ({ p, props }) => ({ labels: ["All", ...p.pack.statuses].slice(0, num(props, "count")) }),
  tabs: ({ p, props }) => ({ labels: ["All", ...p.pack.categories].slice(0, num(props, "count")) }),
  steps: ({ props }) => ({ labels: GENERIC.steps.slice(0, num(props, "count")) }),
  chart: (c) => ({ series: series(c, num(c.props, "series")), labels: c.p.pack.categories.slice(0, num(c.props, "series")), values: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] }),
  drawer: ({ p }) => {
    const e = p.focus();
    return { person: e.person, sub: p.x(p.pack.roles[0]) };
  },
  sheet: ({ p, props }) => props.kind === "sheet" ? { heading: p.focus().title, lines: p.sentences(2) } : void 0,
  modal: ({ p, label }) => ({ heading: `${label("action-1")} ${p.focus().title}?`, lines: p.sentences(1) }),
  // ---- blocks
  navbar: ({ p }) => ({ motif: p.pack.motifs[0] }),
  "app-shell": ({ p }) => ({ values: ["9:41", `app.example.com/${lower(p.pack.noun[1]).replace(/[^a-z]+/g, "-")}`] }),
  "page-header": ({ p }) => ({
    values: [...GENERIC.crumbs, p.pack.noun[1]],
    sub: `${p.ink.int(8, 60)} ${lower(p.pack.noun[1])} \xB7 updated ${p.x("{ago}")}`,
    labels: ["All", ...p.pack.categories].slice(0, 3)
  }),
  "sign-in-form": ({ p }) => ({ values: [p.x(GENERIC.email), GENERIC.password], lines: ["New here?"] }),
  "sign-up-form": ({ p, props }) => {
    const labels = ["Full name", "Email", "Password", "Phone", "Date of birth", "Postcode"].slice(0, num(props, "fields"));
    const values = [p.ink.name(), p.x(GENERIC.email), GENERIC.password, p.x(GENERIC.phone), p.x("{date}, 19{#70-99}"), p.x("{A-F}{#1-9} {#1-9}{A-F}{A-F}")].slice(0, labels.length);
    return { labels, values, lines: ["I agree to the", "Already have an account?"] };
  },
  "verify-code": ({ p }) => ({ lines: [p.x(GENERIC.verifyLead[1])], values: p.x(GENERIC.code).split(""), sub: "Didn't get it?" }),
  "forgot-password": ({ p, props }) => props.step === "request" ? { lines: [GENERIC.forgotLead[1]], values: [p.x(GENERIC.email)] } : { heading: GENERIC.sentLead[0], lines: [GENERIC.sentLead[1]] },
  "onboarding-step": ({ p }) => ({ motif: p.pack.motifs[0], heading: p.pack.pitch[0], lines: [p.pack.pitch[1]] }),
  wizard: (c) => ({ groups: (c.archetype === "sign-up" ? ["Account", "Profile", "Preferences", "Review", "Verify", "Done"] : GENERIC.steps).slice(0, num(c.props, "steps")), ...fieldPairs(c, 3), lines: [c.p.focus().title, c.p.focus().sub] }),
  "form-block": (c) => ({ ...fieldPairs(c, num(c.props, "fields")), groups: ["Details", "More", "Notes"].slice(0, num(c.props, "sections")) }),
  "filter-panel": ({ p, props }) => {
    const groups = [...GENERIC.filterGroups, "Owner", "Price", "More"].slice(0, num(props, "groups"));
    const options = [p.pack.statuses, p.pack.categories, ["Today", "This week", "This month"], FIRST_NAMES.slice(0, 3), ["Under $50", "$50\u2013$200", "Over $200"], ["Saved", "Shared", "Archived"]];
    return { groups, labels: groups.flatMap((_, g) => options[g].slice(0, 3)) };
  },
  "settings-group": ({ p, props }) => {
    const rows = p.cycle(SETTINGS_ROWS, num(props, "groups") * num(props, "rows"), true);
    return { groups: ["General", "Account", "Privacy", "About"].slice(0, num(props, "groups")), labels: rows.map(([l]) => l), values: rows.map(([, v]) => p.x(v)) };
  },
  "stats-row": (c) => ({ stats: stats(c, num(c.props, "count")), ...c.props.chart === true ? { series: series(c, num(c.props, "count")) } : {} }),
  "stacked-list": (c) => ({ items: rowItems(c, num(c.props, "rows")), ...num(c.props, "sections") > 0 ? { groups: GENERIC.sectionHeads.slice(0, num(c.props, "sections")) } : {} }),
  "card-grid": (c) => ({ items: c.p.entities(num(c.props, "items")).map((e) => ({ title: e.title, sub: e.sub, meta: e.meta, status: e.status, motif: e.motif })) }),
  "data-table": (c) => ({
    labels: [...c.p.pack.columns],
    items: c.p.entities(num(c.props, "rows")).map((e) => ({ title: e.title, cells: [e.title, e.sub, e.status, e.meta, e.category, e.person, e.date, e.amount] }))
  }),
  "blog-list": (c) => ({ items: c.p.entities(num(c.props, "posts")).map((e, i) => ({ title: e.title, sub: `${e.category} \xB7 ${e.date}`, text: c.p.x(c.p.pack.lines[i % c.p.pack.lines.length]), person: e.person, motif: e.motif })) }),
  "long-form": ({ p, props, archetype }) => {
    const n = num(props, "sections");
    return { groups: archetype === "legal" ? LEGAL_HEADS.slice(0, n).map((h, i) => `${i + 1}. ${h}`) : ["About", "Details", "Notes", "More", "History", "Related"].slice(0, n), lines: p.sentences(n * 3) };
  },
  "detail-header": ({ p, props }) => {
    const e = p.focus();
    return { heading: e.title, sub: e.sub, motif: e.motif, labels: [e.status, e.category, e.date, e.amount].slice(0, num(props, "meta")) };
  },
  "hero-banner": ({ p, props }) => ({
    heading: p.pack.pitch[0],
    sub: p.pack.categories[0],
    lines: [p.pack.pitch[1]],
    labels: p.cycle(p.pack.categories, Math.max(1, num(props, "bullets")), true),
    motif: p.pack.motifs[0]
  }),
  accordion: ({ p, props, archetype }) => {
    const n = num(props, "items");
    const heads = archetype === "legal" ? LEGAL_HEADS.slice(0, n) : p.cycle(["How does this work?", "What is included?", "Can I change this later?", "Who can see my details?", "How do updates arrive?", "Where are records kept?", "What happens when I cancel?", "Need more help?"], n, true);
    const lines = p.sentences(n);
    return { items: heads.map((title, i) => ({ title, text: lines[i] })) };
  },
  "comment-list": ({ p, props }) => {
    const n = num(props, "comments");
    return {
      heading: `${n} comments`,
      items: p.entities(n).map((e, i) => ({ title: e.person, person: e.person, text: p.x(p.pack.remarks[(i + p.focusIndex) % p.pack.remarks.length]), meta: p.x("{ago}") }))
    };
  },
  "profile-header": ({ p }) => {
    const e = p.focus();
    return { person: e.person, sub: p.x(p.pack.roles[0]), stats: p.pack.profile.map(([label, value]) => ({ label, value: p.x(value) })) };
  },
  "feed-post": ({ p, props }) => ({
    items: p.entities(num(props, "count")).map((e, i) => ({
      title: e.title,
      person: e.person,
      meta: p.x("{ago}"),
      text: p.x(i % 2 === 0 ? p.pack.lines[(i + p.focusIndex) % p.pack.lines.length] : p.pack.remarks[i % p.pack.remarks.length]),
      sub: e.sub,
      motif: e.motif
    }))
  }),
  "gallery-section": ({ p, props }) => ({ items: p.entities(num(props, "items")).map((e) => ({ title: e.title, motif: e.motif })) }),
  "product-card-list": ({ p, props }) => ({ items: p.entities(num(props, "items")).map((e, i) => ({ title: e.title, meta: e.amount, sub: e.sub, motif: e.motif, rating: 3 + (i + p.focusIndex) % 3 })) }),
  "pricing-cards": ({ p, props }) => {
    const tiers = num(props, "tiers");
    const feats = num(props, "features");
    const tierNames = ["Starter", "Pro", "Team", "Enterprise"].slice(0, tiers);
    const prices = ["$0 / mo", "$19 / mo", "$49 / mo", "Custom"].slice(0, tiers);
    const subs = ["For getting started", "For active workflows", "For growing teams", "For large organizations"].slice(0, tiers);
    const featurePool = [
      ...p.pack.categories.map((c) => `${c} tracking`),
      "Unlimited history",
      "Shared workspace",
      "Priority support",
      "Audit exports"
    ];
    return {
      groups: ["Monthly", "Annual"],
      items: tierNames.map((title, i) => ({
        title,
        meta: prices[i],
        sub: subs[i],
        status: "Most popular",
        cells: Array.from({ length: feats }, (_, f) => featurePool[(i + f) % featurePool.length])
      }))
    };
  },
  "empty-state": ({ p, props }) => {
    const [heading, line] = props.cause === "no-results" ? GENERIC.noResults : props.cause === "cleared" ? GENERIC.cleared : p.pack.empty;
    return { motif: p.pack.motifs[0], heading, lines: [p.x(line)] };
  },
  "error-state": ({ props }) => ({ lines: [GENERIC.errors[String(props.kind)] ?? GENERIC.errors.generic] }),
  "success-state": ({ p }) => {
    const e = p.focus();
    return { heading: p.pack.success[0], lines: [p.x(p.pack.success[1])], values: [e.title, e.sub, e.amount] };
  },
  "confirm-dialog": ({ p, label }) => ({ heading: `${label("confirm")} ${p.focus().title}?`, lines: p.sentences(1) })
};
function contentTitle(archetype, pack, flow, blocks = []) {
  if (blocks.includes("forgot-password")) return GENERIC.forgotLead[0];
  const focus = () => new Picker(pack, flow, flow, "title", true).focus();
  switch (archetype) {
    case "home":
      return pack.home;
    case "list":
    case "gallery":
      return pack.noun[1];
    case "detail":
      return focus().title;
    case "form":
      return `New ${lower(pack.noun[0])}`;
    case "profile":
      return focus().person;
    case "search":
      return `Search ${lower(pack.noun[1])}`;
    case "feed":
      return "Activity";
    case "welcome":
      return pack.pitch[0];
    case "sign-in":
      return GENERIC.signInLead[0];
    case "sign-up":
      return GENERIC.signUpLead[0];
    case "verify":
      return GENERIC.verifyLead[0];
    default:
      return void 0;
  }
}
function domainTitle(archetype, pack) {
  switch (archetype) {
    case "list":
    case "gallery":
      return pack.noun[1];
    case "detail":
      return pack.noun[0];
    case "form":
      return `New ${lower(pack.noun[0])}`;
    case "search":
      return `Search ${lower(pack.noun[1])}`;
    default:
      return void 0;
  }
}
function objectLabel(intent, label, noun) {
  return OBJECT_VERBS.has(intent) ? `${label} ${lower(noun)}` : void 0;
}
var OBJECT_VERBS = /* @__PURE__ */ new Set(["edit", "delete", "share", "save", "add", "submit", "upload"]);
function loneAction(pack, archetype, slot) {
  const r = recipe(archetype);
  const region = r.sections.find((s) => s.slot === slot.slot)?.region;
  const c = component(slot.block);
  const present = presentElements(c, { ...Object.fromEntries(Object.entries(c.props).map(([k, d]) => [k, d.default])), ...slot.props });
  const intentOf = (element2) => slot.intents?.[element2] ?? defaultIntent(r, c, element2);
  const named = Object.fromEntries(present.flatMap((element2) => {
    const nav = INTENT_BY_ID.get(intentOf(element2))?.nav;
    const words2 = intentOf(element2).startsWith("open-") && nav?.to === "archetype" ? domainTitle(nav.archetype, pack) : void 0;
    return words2 ? [[element2, words2]] : [];
  }));
  if (Object.keys(named).length > 0) return named;
  if (region === "header" || region === "nav") return void 0;
  if (present.length !== 1) return void 0;
  const element = present[0];
  const intent = slot.intents?.[element] ?? defaultIntent(r, c, element);
  const label = INTENT_BY_ID.get(intent)?.label ?? intent;
  const words = objectLabel(intent, label, c.id === "profile-header" || archetype === "profile" ? "profile" : pack.noun[0]);
  return words ? { [element]: words } : void 0;
}
function packOf(id) {
  return PACK_BY_ID.get(id ?? GENERIC_PACK) ?? PACK_BY_ID.get(GENERIC_PACK);
}
function fillSlot(pack, spec, key, slot) {
  if (!slot.block) return void 0;
  const actions = loneAction(pack, spec.archetype, { ...slot, block: slot.block });
  const filled = fillWords(pack, spec, key, { ...slot, block: slot.block });
  if (!actions) return filled;
  return { ...filled ?? {}, actions };
}
function fillWords(pack, spec, key, slot) {
  const filler = FILLERS[slot.block];
  if (!filler) return void 0;
  const c = component(slot.block);
  const props = { ...Object.fromEntries(Object.entries(c.props).map(([k, d]) => [k, d.default])), ...slot.props };
  const lead = slot.slot.startsWith("main");
  const p = new Picker(pack, spec.flow || key, key, slot.slot, lead);
  const label = (element) => {
    const intent = slot.intents?.[element] ?? (c.elements?.[element] ? defaultIntent(recipe(spec.archetype), c, element) : element);
    return INTENT_BY_ID.get(intent)?.label ?? intent;
  };
  return filler({ p, props, archetype: spec.archetype, label });
}

// packages/modules/wireframe/src/content/flesh-spec.ts
function seedKey(spec, itemId) {
  return spec.variantOf ?? itemId;
}
function isBlueprint(spec) {
  return spec.slots.every((s) => s.block === null);
}
function fleshSpec(spec, key, pack, meta = {}) {
  if (isBlueprint(spec)) return barsSpec(spec);
  const title = contentTitle(spec.archetype, pack, spec.flow || key, spec.slots.map((s) => s.block));
  const content = {
    source: "pack",
    pack: pack.id,
    ...meta.p !== void 0 ? { p: Math.round(meta.p * 1e3) / 1e3 } : {},
    ...meta.by ? { by: meta.by } : {},
    ...title !== void 0 ? { title } : {},
    ...spec.archetype === "detail" ? { bar: pack.noun[0] } : {}
  };
  return { ...spec, title: fleshedTitle(spec, pack), content, slots: spec.slots.map((slot) => withFill(slot, fillSlot(pack, spec, key, slot))) };
}
function fleshedTitle(spec, pack) {
  const archetype = RECIPE_BY_ID.get(spec.archetype)?.title;
  const earlier = spec.content?.pack ? domainTitle(spec.archetype, packOf(spec.content.pack)) : void 0;
  if (spec.title !== archetype && (earlier === void 0 || spec.title !== earlier)) return spec.title;
  return domainTitle(spec.archetype, pack) ?? archetype ?? spec.title;
}
function barsSpec(spec) {
  const given = spec.content?.pack ? domainTitle(spec.archetype, packOf(spec.content.pack)) : void 0;
  const archetype = RECIPE_BY_ID.get(spec.archetype)?.title;
  const out = {
    ...spec,
    ...given !== void 0 && spec.title === given && archetype ? { title: archetype } : {},
    slots: spec.slots.map((slot) => withFill(slot, void 0))
  };
  delete out.content;
  return out;
}
function withFill(slot, fill) {
  const out = { ...slot };
  if (fill) out.fill = fill;
  else delete out.fill;
  return out;
}
function refill(spec, key, slots) {
  if (!spec.content) return spec;
  const pack = packOf(spec.content.pack);
  return { ...spec, slots: spec.slots.map((slot) => slots.includes(slot.slot) ? withFill(slot, fillSlot(pack, spec, key, slot)) : slot) };
}
function wordsOf(fill) {
  const out = {};
  if (!fill) return out;
  for (const key of ["heading", "sub", "person"]) if (fill[key] !== void 0) out[key] = fill[key];
  for (const key of ["lines", "labels", "values", "groups"]) fill[key]?.forEach((w, i) => out[`${key}.${i}`] = w);
  fill.items?.forEach((it, i) => {
    for (const key of ["title", "sub", "status", "meta", "person", "text"]) if (it[key] !== void 0) out[`items.${i}.${key}`] = it[key];
    it.cells?.forEach((w, j) => out[`items.${i}.cells.${j}`] = w);
  });
  fill.stats?.forEach((s, i) => {
    out[`stats.${i}.label`] = s.label;
    out[`stats.${i}.value`] = s.value;
    if (s.delta !== void 0) out[`stats.${i}.delta`] = s.delta;
  });
  Object.entries(fill.actions ?? {}).forEach(([element, w]) => {
    out[`actions.${element}`] = w;
  });
  return out;
}
function withWords(fill, words, where) {
  const have = wordsOf(fill);
  const paths = Object.keys(have);
  const pairs = Array.isArray(words) ? words.map((w, i) => {
    if (i >= paths.length) throw new Error(`${where}: ${words.length} words given, but the slot holds ${paths.length}`);
    return [paths[i], w];
  }) : Object.entries(words);
  const out = structuredClone(fill);
  for (const [path, word] of pairs) {
    if (!(path in have)) throw new Error(`${where}: no word at "${path}" \u2014 it holds ${paths.join(", ")}`);
    if (typeof word !== "string") throw new Error(`${where}: "${path}" must be a string`);
    const parts = path.split(".");
    let at = out;
    for (const part of parts.slice(0, -1)) at = at[part];
    at[parts[parts.length - 1]] = word;
  }
  return out;
}
function copyOf(spec) {
  return {
    title: spec.content?.title ?? spec.title,
    content: spec.content ?? null,
    slots: spec.slots.filter((s) => s.block && s.fill).map((s) => ({ slot: s.slot, block: s.block, words: wordsOf(s.fill) }))
  };
}
function applyCopy(spec, file, by) {
  if (!spec.content) throw new Error("this screen draws bars \u2014 `isocan wire flesh <screen>` fills it first, then its words can be replaced");
  const bySlot = new Map(spec.slots.map((s) => [s.slot, s]));
  for (const name of Object.keys(file.slots ?? {})) {
    const slot = bySlot.get(name);
    if (!slot) throw new Error(`no slot "${name}" on this screen \u2014 it has ${spec.slots.map((s) => s.slot).join(", ")}`);
    if (!slot.fill) throw new Error(`slot "${name}" (${slot.block ?? "undecided"}) holds no words`);
  }
  if (file.title !== void 0 && typeof file.title !== "string") throw new Error("title must be a string");
  const slots = spec.slots.map((slot) => {
    const words = file.slots?.[slot.slot];
    return words && slot.fill ? { ...slot, fill: withWords(slot.fill, words, `slot "${slot.slot}"`) } : slot;
  });
  const pack = spec.content.pack;
  const title = file.title ?? spec.content.title;
  if (file.bar !== void 0 && typeof file.bar !== "string") throw new Error("bar must be a string");
  const bar = file.bar ?? spec.content.bar;
  const content = { source: "copy", by, ...pack ? { pack } : {}, ...title !== void 0 ? { title } : {}, ...bar !== void 0 ? { bar } : {} };
  return { ...spec, content, slots };
}

// packages/modules/wireframe/src/copy-schema.ts
function ensureFleshedForCopy(spec, key) {
  const resolvedKey = key ?? seedKey(spec, spec.archetype || "screen");
  if (!spec.content) {
    return fleshSpec(spec, resolvedKey, packOf(void 0), { by: "pack" });
  }
  const pack = packOf(spec.content.pack);
  let missingFill = false;
  for (const s of spec.slots) {
    if (s.block && !s.fill) {
      missingFill = true;
      break;
    }
  }
  if (!missingFill) return spec;
  const fleshed = fleshSpec(spec, resolvedKey, pack, { by: spec.content.by ?? "pack" });
  return {
    ...spec,
    slots: spec.slots.map((s, i) => s.fill ? s : fleshed.slots[i] ?? s)
  };
}
function describeWordPath(spec, slot, path, sample) {
  if (path.startsWith("actions.") && slot.block) {
    const element = path.slice("actions.".length);
    const c = component(slot.block);
    const r = recipe(spec.archetype);
    const intent = slot.intents?.[element] ?? (c.elements?.[element] ? defaultIntent(r, c, element) : element);
    const intentLabel = INTENT_BY_ID.get(intent)?.label ?? intent;
    return `Action label bound to intent "${intent}" (keep verb "${intentLabel}", e.g. "${sample}")`;
  }
  return `${slot.block ?? "slot"} ${path} (e.g. "${sample}")`;
}
function blockContentSchema(spec) {
  const fleshed = ensureFleshedForCopy(spec);
  const slotProps = {};
  const requiredSlots = [];
  for (const slot of fleshed.slots) {
    if (!slot.block || !slot.fill) continue;
    const words = wordsOf(slot.fill);
    const paths = Object.keys(words);
    if (paths.length === 0) continue;
    const wordProps = {};
    for (const p of paths) {
      wordProps[p] = {
        type: "string",
        description: describeWordPath(fleshed, slot, p, words[p] ?? "")
      };
    }
    const variant = typeof slot.props?.variant === "string" ? slot.props.variant : "default";
    slotProps[slot.slot] = {
      type: "object",
      description: `Words for slot "${slot.slot}" (block "${slot.block}", variant "${variant}")`,
      properties: wordProps,
      required: paths,
      additionalProperties: false
    };
    requiredSlots.push(slot.slot);
  }
  const properties = {
    title: {
      type: "string",
      description: `Screen heading for ${fleshed.archetype} screen (currently "${fleshed.content?.title ?? fleshed.title}")`
    },
    ...fleshed.archetype === "detail" || fleshed.content?.bar !== void 0 ? {
      bar: {
        type: "string",
        description: `App bar context label above the detail heading (currently "${fleshed.content?.bar ?? fleshed.title}")`
      }
    } : {},
    slots: {
      type: "object",
      description: "Replacement words keyed by slot id and dot-path",
      properties: slotProps,
      required: requiredSlots,
      additionalProperties: false
    }
  };
  return {
    type: "object",
    description: `Wireframe copy schema for screen "${fleshed.title}" (archetype "${fleshed.archetype}", ${COMPONENTS.size} catalog components supported)`,
    properties,
    required: ["title", "slots"],
    additionalProperties: false
  };
}
function validateCopyPayload(spec, raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("copy payload must be a JSON object");
  }
  const obj = raw;
  if ("intents" in obj) {
    throw new Error("copy payload cannot modify actionable intents");
  }
  if (obj.title !== void 0 && (typeof obj.title !== "string" || obj.title.trim().length === 0)) {
    throw new Error("title must be a non-empty string");
  }
  if (obj.bar !== void 0 && (typeof obj.bar !== "string" || obj.bar.trim().length === 0)) {
    throw new Error("bar must be a non-empty string");
  }
  if (obj.slots !== void 0 && (!obj.slots || typeof obj.slots !== "object" || Array.isArray(obj.slots))) {
    throw new Error("slots must be an object mapping slot names to words");
  }
  const fleshed = ensureFleshedForCopy(spec);
  const bySlot = new Map(fleshed.slots.map((s) => [s.slot, s]));
  const normalizedSlots = {};
  for (const [slotName, rawEntry] of Object.entries(obj.slots ?? {})) {
    const slot = bySlot.get(slotName);
    if (!slot) {
      throw new Error(`no slot "${slotName}" on this screen \u2014 it has ${fleshed.slots.map((s) => s.slot).join(", ")}`);
    }
    if (!slot.fill) {
      if (rawEntry && typeof rawEntry === "object" && !Array.isArray(rawEntry) && Object.keys(rawEntry).length === 0) {
        continue;
      }
      throw new Error(`slot "${slotName}" (${slot.block ?? "undecided"}) holds no words`);
    }
    const have = wordsOf(slot.fill);
    const validPaths = Object.keys(have);
    if (Array.isArray(rawEntry)) {
      if (rawEntry.length > validPaths.length) {
        throw new Error(`slot "${slotName}": ${rawEntry.length} words given, but the slot holds ${validPaths.length}`);
      }
      for (let i = 0; i < rawEntry.length; i++) {
        if (typeof rawEntry[i] !== "string") {
          throw new Error(`slot "${slotName}": entry ${i} must be a string`);
        }
      }
      normalizedSlots[slotName] = rawEntry;
      continue;
    }
    if (!rawEntry || typeof rawEntry !== "object") {
      throw new Error(`slot "${slotName}" must be an object or array of strings`);
    }
    const unwrapped = "words" in rawEntry && typeof rawEntry.words === "object" && rawEntry.words !== null ? rawEntry.words : rawEntry;
    const slotWords = {};
    for (const [path, val] of Object.entries(unwrapped)) {
      if (!(path in have)) {
        throw new Error(`slot "${slotName}": no word at "${path}" \u2014 it holds ${validPaths.join(", ")}`);
      }
      if (typeof val !== "string") {
        throw new Error(`slot "${slotName}": "${path}" must be a string`);
      }
      slotWords[path] = val;
    }
    normalizedSlots[slotName] = slotWords;
  }
  return {
    ...typeof obj.title === "string" ? { title: sanitizeFlowTitle(obj.title) } : {},
    ...typeof obj.bar === "string" ? { bar: sanitizeFlowTitle(obj.bar) } : {},
    slots: normalizedSlots
  };
}
async function generateWireCopy(spec, generator = stubTextGenerator(1), opts = {}) {
  const base = ensureFleshedForCopy(spec, opts.key);
  const schema = blockContentSchema(base);
  const current = copyOf(base);
  const slotSchemas = schema.properties?.slots?.properties ?? {};
  const wordySlotIds = Object.keys(slotSchemas);
  const totalWordPaths = current.slots.reduce((sum, s) => sum + Object.keys(s.words).length, 0);
  if (totalWordPaths <= 20 || wordySlotIds.length <= 3) {
    const promptLines = [
      `Write realistic product UI copy for the "${base.title}" screen (archetype: ${base.archetype}).`,
      `Flow request: ${base.request || base.title}`,
      ...opts.brief ? [`Copy brief: ${opts.brief}`] : [],
      `Current slots and sample words: ${JSON.stringify(current.slots)}`
    ];
    const raw = await generator.generateJson(promptLines.join("\n"), schema);
    const validated2 = validateCopyPayload(base, raw);
    return applyCopy(base, validated2, generator.name);
  }
  const mergedSlots = {};
  let mergedTitle;
  let mergedBar;
  for (let i = 0; i < wordySlotIds.length; i += 3) {
    const batchIds = wordySlotIds.slice(i, i + 3);
    const batchProps = {};
    for (const id of batchIds) batchProps[id] = slotSchemas[id];
    const includeTop = i === 0;
    const batchSchema = {
      type: "object",
      properties: {
        ...includeTop && schema.properties?.title ? { title: schema.properties.title } : {},
        ...includeTop && schema.properties?.bar ? { bar: schema.properties.bar } : {},
        slots: {
          type: "object",
          properties: batchProps,
          required: batchIds,
          additionalProperties: false
        }
      },
      required: [
        ...includeTop && schema.properties?.title ? ["title"] : [],
        ...includeTop && schema.properties?.bar ? ["bar"] : [],
        "slots"
      ],
      additionalProperties: false
    };
    const batchSlots = current.slots.filter((s) => batchIds.includes(s.slot));
    const batchPrompt = [
      `Write realistic product UI copy for slots ${batchIds.join(", ")} on the "${base.title}" screen (archetype: ${base.archetype}).`,
      `Flow request: ${base.request || base.title}`,
      ...opts.brief ? [`Copy brief: ${opts.brief}`] : [],
      `Current slots and sample words: ${JSON.stringify(batchSlots)}`
    ].join("\n");
    const part = await generator.generateJson(batchPrompt, batchSchema);
    if (includeTop) {
      if (typeof part.title === "string") mergedTitle = part.title;
      if (typeof part.bar === "string") mergedBar = part.bar;
    }
    Object.assign(mergedSlots, part.slots ?? {});
  }
  const mergedRaw = {
    ...mergedTitle !== void 0 ? { title: mergedTitle } : {},
    ...mergedBar !== void 0 ? { bar: mergedBar } : {},
    slots: mergedSlots
  };
  const validated = validateCopyPayload(base, mergedRaw);
  return applyCopy(base, validated, generator.name);
}
async function rewriteSlotCopy(spec, slotId, instruction, generator = stubTextGenerator(1)) {
  const base = ensureFleshedForCopy(spec);
  const slot = base.slots.find((s) => s.slot === slotId);
  if (!slot) throw new Error(`${base.title} has no slot "${slotId}" to update content on`);
  const full = blockContentSchema(base);
  const slotSchema = full.properties?.slots?.properties?.[slotId];
  if (!slot.fill || !slotSchema) throw new Error(`slot "${slotId}" (${slot.block ?? "undecided"}) holds no words to rewrite`);
  const schema = {
    type: "object",
    description: `Rewritten words for slot "${slotId}" on screen "${base.title}"`,
    properties: {
      slots: {
        type: "object",
        description: "Replacement words keyed by slot id and dot-path",
        properties: { [slotId]: slotSchema },
        required: [slotId],
        additionalProperties: false
      }
    },
    required: ["slots"],
    additionalProperties: false
  };
  const prompt = [
    `Rewrite the UI copy in slot "${slotId}" (block "${slot.block}") of the "${base.title}" screen (archetype: ${base.archetype}).`,
    `Flow request: ${base.request || base.title}`,
    `Edit instruction: ${instruction}`,
    `Follow the instruction by writing the slot's words \u2014 do not repeat the instruction as copy, and keep each action's verb.`,
    `Current words: ${JSON.stringify(wordsOf(slot.fill))}`
  ].join("\n");
  const raw = await generator.generateJson(prompt, schema);
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const extra = Object.keys(raw).filter((k) => k !== "slots");
    if (extra.length > 0) throw new Error(`a content edit changes only slot "${slotId}" \u2014 the answer also set ${extra.join(", ")}`);
  }
  const validated = validateCopyPayload(base, raw);
  const others = Object.keys(validated.slots ?? {}).filter((k) => k !== slotId);
  if (others.length > 0) throw new Error(`a content edit changes only slot "${slotId}" \u2014 the answer also set ${others.join(", ")}`);
  const words = validated.slots?.[slotId];
  if (!words) throw new Error(`the answer held no words for slot "${slotId}"`);
  return withWords(slot.fill, words, `slot "${slotId}"`);
}
function sanitizeFlowTitle(raw) {
  let text = raw.trim();
  const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
  text = firstLine ?? "";
  text = text.replace(
    /^(?:sure[!,.]?\s*|certainly[!,.]?\s*|of course[!,.]?\s*)?(?:here(?:'s| is)\s+(?:a|the|your)\s+(?:suggested\s+|concise\s+)?(?:flow\s+|screen\s+|product\s+|app\s+|brand\s+)?(?:title|name)\s*[:\-–—]\s*)/i,
    ""
  );
  text = text.replace(/^(?:title|name|flow|brand|screen)\s*[:\-–—]\s*/i, "");
  text = text.replace(/^[`*"'\u2018\u2019\u201c\u201d.;:!?]+|[`*"'\u2018\u2019\u201c\u201d.;:!?]+$/g, "").trim();
  text = text.replace(/\s+/g, " ");
  if (text.length > 48) {
    text = text.slice(0, 48).replace(/\s+\S*$/, "").trim() || text.slice(0, 48).trim();
  }
  return text || "Untitled";
}
var NAV_BLOCKS = /* @__PURE__ */ new Set(["tab-bar", "side-nav", "navbar"]);
function flowNameSchema(specs) {
  const titleProps = {};
  const requiredKeys = [];
  let navItemCount = 4;
  for (let i = 0; i < specs.length; i++) {
    const s = ensureFleshedForCopy(specs[i], `screen-${i}`);
    const key = `${s.archetype}-${i}`;
    titleProps[key] = {
      type: "string",
      description: `Specific screen title for archetype "${s.archetype}" (currently "${s.title}")`
    };
    requiredKeys.push(key);
    for (const slot of s.slots) {
      if (slot.block && NAV_BLOCKS.has(slot.block)) {
        const actionKeys = Object.keys(slot.fill?.actions ?? {});
        if (actionKeys.length > 0) navItemCount = actionKeys.length;
        else if (slot.fill?.items?.length) navItemCount = slot.fill.items.length;
      }
    }
  }
  return {
    type: "object",
    description: "Coherent flow naming: brand, per-screen titles, and shared navigation labels",
    properties: {
      brand: {
        type: "string",
        description: "Short brand or product name (1-3 words)"
      },
      titles: {
        type: "object",
        description: "Screen title keyed by screen id",
        properties: titleProps,
        required: requiredKeys,
        additionalProperties: false
      },
      navLabels: {
        type: "array",
        description: "Shared navigation item labels in order across the flow",
        items: { type: "string", description: "Navigation tab or link label" },
        minItems: navItemCount,
        maxItems: navItemCount
      }
    },
    required: ["brand", "titles", "navLabels"],
    additionalProperties: false
  };
}
async function nameFlow(specs, request, generator = stubTextGenerator(1)) {
  if (specs.length === 0) {
    return { brand: "Acme", titles: {}, navLabels: [], specs: [] };
  }
  const fleshedSpecs = specs.map((s, i) => ensureFleshedForCopy(s, seedKey(s, `screen-${i}`)));
  const schema = flowNameSchema(fleshedSpecs);
  const flowReq = request ?? fleshedSpecs[0]?.request ?? fleshedSpecs[0]?.title ?? "Product flow";
  const prompt = [
    `Name the product brand, each screen's specific title, and the shared navigation bar labels for this flow.`,
    `Flow request: ${flowReq}`,
    `Screens: ${fleshedSpecs.map((s, i) => `${s.archetype}-${i} (${s.archetype})`).join(", ")}`
  ].join("\n");
  const raw = await generator.generateJson(prompt, schema);
  const brand = sanitizeFlowTitle(raw?.brand ?? "Acme");
  const navLabels = (raw?.navLabels ?? []).map((l) => sanitizeFlowTitle(String(l)));
  const titles = {};
  const namedSpecs = fleshedSpecs.map((spec, i) => {
    const key = `${spec.archetype}-${i}`;
    const rawTitle = raw?.titles?.[key] ?? spec.content?.title ?? spec.title;
    const cleanTitle = sanitizeFlowTitle(rawTitle);
    titles[key] = cleanTitle;
    const slots = spec.slots.map((slot) => {
      if (!slot.block) return slot;
      if (NAV_BLOCKS.has(slot.block) && navLabels.length > 0) {
        const baseFill = slot.fill ? structuredClone(slot.fill) : {};
        const actionKeys = Object.keys(baseFill.actions ?? {});
        const keysToFill = actionKeys.length > 0 ? actionKeys : navLabels.map((_, idx) => `item-${idx + 1}`);
        const actions = { ...baseFill.actions ?? {} };
        keysToFill.forEach((k, idx) => {
          actions[k] = navLabels[idx % navLabels.length];
        });
        const fill = {
          ...baseFill,
          actions,
          ...slot.block === "navbar" ? { heading: brand } : {},
          ...baseFill.items ? {
            items: baseFill.items.map((it, idx) => ({
              ...it,
              title: navLabels[idx % navLabels.length] ?? it.title
            }))
          } : {}
        };
        return { ...slot, fill };
      }
      return slot;
    });
    const content = spec.content ? {
      ...spec.content,
      source: "copy",
      by: generator.name,
      title: cleanTitle
    } : {
      source: "copy",
      by: generator.name,
      title: cleanTitle
    };
    return {
      ...spec,
      title: cleanTitle,
      content,
      slots
    };
  });
  return { brand, titles, navLabels, specs: namedSpecs };
}
function resolveTextGenerator(opts = {}) {
  if (!opts.useStub && opts.text) {
    return envTextGenerator({ apiKey: opts.text.key, provider: opts.text.provider, ...opts.text.model ? { model: opts.text.model } : {} });
  }
  if (!opts.useStub && process.env.ISOCAN_TEXT_API_KEY) {
    return envTextGenerator();
  }
  return stubTextGenerator(opts.seed ?? 1);
}
async function copyAiOnCanvas(port, canvas, all, screens, generator = stubTextGenerator(1), opts = {}) {
  const group = opts.group ?? newGroupId();
  const planned = [];
  for (const s of screens) {
    if (isBlueprint(s.spec)) continue;
    const item = canvas.items[s.item];
    if (!item) continue;
    const next = await generateWireCopy(s.spec, generator, {
      ...opts.brief ? { brief: opts.brief } : {},
      key: seedKey(s.spec, s.item)
    });
    if (JSON.stringify(next) === JSON.stringify(s.spec)) continue;
    planned.push({ screen: s, item, next });
  }
  const changed = [];
  for (const { screen, item, next } of planned) {
    if (await writeWire(port, item, next, group, screen.spec)) {
      changed.push({ itemId: screen.item, title: wireTitle(next), spec: next });
    }
  }
  const prototypes = await rebuildPrototypes(
    port,
    canvas,
    all,
    changed.map((c) => ({ item: c.itemId, spec: c.spec })),
    group
  );
  return { group, by: generator.name, changed, prototypes };
}
async function nameFlowOnCanvas(port, canvas, all, screens, generator = stubTextGenerator(1), opts = {}) {
  const group = opts.group ?? newGroupId();
  const targetScreens = screens.filter((s) => !isBlueprint(s.spec));
  const named = await nameFlow(
    targetScreens.map((s) => s.spec),
    opts.request,
    generator
  );
  const changed = [];
  for (let i = 0; i < targetScreens.length; i++) {
    const s = targetScreens[i];
    const next = named.specs[i];
    if (JSON.stringify(next) === JSON.stringify(s.spec)) continue;
    const item = canvas.items[s.item];
    if (!item) continue;
    if (await writeWire(port, item, next, group, s.spec)) {
      changed.push({ itemId: s.item, title: wireTitle(next), spec: next });
    }
  }
  const prototypes = await rebuildPrototypes(
    port,
    canvas,
    all,
    changed.map((c) => ({ item: c.itemId, spec: c.spec })),
    group
  );
  return {
    group,
    by: generator.name,
    brand: named.brand,
    navLabels: named.navLabels,
    changed,
    prototypes
  };
}

export {
  PACKS,
  PACK_BY_ID,
  GENERIC_PACK,
  packOf,
  seedKey,
  isBlueprint,
  fleshSpec,
  barsSpec,
  refill,
  copyOf,
  applyCopy,
  blockContentSchema,
  validateCopyPayload,
  rewriteSlotCopy,
  sanitizeFlowTitle,
  resolveTextGenerator,
  copyAiOnCanvas,
  nameFlowOnCanvas
};
