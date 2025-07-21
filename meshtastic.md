# Meshtastic 

Meshtastic is a free, open-source communication system that lets you send text messages and data without needing cell service, Wi-Fi, or the internet. It works using small, battery-powered radio devices that create a network—called a "mesh"—where each device helps relay messages to others. This means you can stay in touch with friends or teammates even in remote places like mountains, forests, or during emergencies when regular networks go down.

It’s easy to get started: just pair a Meshtastic device with your phone using Bluetooth, and use the app to chat or share your location. The more devices around, the stronger and farther the network can reach. Whether you're hiking, off-grid camping, or preparing for a natural disaster, Meshtastic gives you a private, low-cost way to stay connected—without relying on big tech companies or cell towers.

## Channels

Channels in Meshtastic are like private chat rooms that devices use to communicate. Each channel has a unique name, encryption key, and index slot that must match exactly across devices for them to talk to each other. You can use multiple channels at once (up to 8), each serving a different purpose—like one for chatting, another for sensor data, or a group-specific channel. The table below lists some common channel configurations you can use or customize to connect with others or organize your own mesh network.

| Channel Name | Index | Pre-Shared Key (PSK) | Description |
|--------------|:-----:|----------------------|-------------|
{%- for chan in get_mesh_channels() %}
| {{ chan.name }} | {{ chan.index }} | {{ chan.psk }} | {{ chan.description }} |
{%- endfor %}