import yaml

def define_env(env):
    @env.macro
    def get_mesh_channels():
        with open("data/meshtastic.yml") as f:
            return yaml.safe_load(f)
