# .bash_profile

# Get the aliases and functions
if [ -f ~/.bashrc ]; then
	. ~/.bashrc
fi

# User specific environment and startup programs

PATH=$PATH:$HOME/.local/bin:$HOME/bin

export PATH

A="\\[\e[38;2;90;110;255m\\]"
B="\\[\e[38;2;255;120;0m\\]"
C="\\[\e[38;2;0;255;0m\\]"
D="\\[\e[38;2;255;255;0m\\]"
E="\\[\e[38;2;0;188;255m\\]"

Z="\\[\e[0m\\]"

export PS1="$A\u$B@$C\h $D\w\n$E\$ $Z"
